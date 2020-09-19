import { Button, Classes, Dialog, FormGroup, InputGroup, Intent } from '@blueprintjs/core'
import { BotConfig, BotTemplate } from 'botpress/sdk'
import { lang } from 'botpress/shared'
import _ from 'lodash'
import React, { Component } from 'react'
// import { connect } from 'react-redux'

import api from '../../../api'

export const sanitizeBotId = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s/g, '-')
    .replace(/[^a-z0-9_-]/g, '')

interface OwnProps {
  isOpen: boolean
  botId: string | null
  onCloneTemplateSuccess: () => void
  toggle: () => void
}

interface State {
  desc: string
  templateName: string
  isProcessing: boolean

  error: any

  templates: any
}

const defaultState = {
  desc: '',
  templateName: '',

  error: undefined,
  isProcessing: false
}

class CloneBotModal extends Component<OwnProps, State> {
  private _form: HTMLFormElement | null = null

  state: State = {
    templates: [],
    ...defaultState
  }

  handleNameChanged = e => {
    const templateName = e.target.value
    this.setState({ templateName: sanitizeBotId(templateName) })
  }

  handleDescChanged = e => {
    const desc = e.target.value
    this.setState({ desc: desc })
  }

  createTemplate = async e => {
    e.preventDefault()
    if (this.isButtonDisabled) {
      return
    }
    this.setState({ isProcessing: true })

    const newTemplate = {
      botId: this.props.botId,
      name: this.state.templateName,
      desc: this.state.desc
    }

    try {
      await api.getSecured().post(`/modules/botTemplates`, newTemplate)
      this.props.onCloneTemplateSuccess()
      this.toggleDialog()
    } catch (error) {
      this.setState({ error: error.message, isProcessing: false })
    }
  }

  toggleDialog = () => {
    this.setState({ ...defaultState })
    this.props.toggle()
  }

  get isButtonDisabled() {
    const { isProcessing, templateName } = this.state
    const isNameOrIdInvalid = !templateName
    return isNameOrIdInvalid || isProcessing || !this._form || !this._form.checkValidity()
  }

  render() {
    return (
      <Dialog
        title={lang.tr('admin.workspace.template.create.newTemplate')}
        icon="add"
        isOpen={this.props.isOpen}
        onClose={this.toggleDialog}
        transitionDuration={0}
        canOutsideClickClose={false}
      >
        <form ref={form => (this._form = form)}>
          <div className={Classes.DIALOG_BODY}>
            <FormGroup
              label={lang.tr('admin.workspace.template.create.name')}
              labelFor="template-name"
              labelInfo="*"
              helperText={lang.tr('admin.workspace.template.create.nameHelper')}
            >
              <InputGroup
                id="input-template-name"
                tabIndex={1}
                placeholder={lang.tr('admin.workspace.template.create.namePlaceholder')}
                minLength={3}
                required
                value={this.state.templateName}
                onChange={this.handleNameChanged}
                autoFocus
              />
            </FormGroup>

            <FormGroup
              label={lang.tr('admin.workspace.template.create.desc')}
              labelFor="templateDesc"
              labelInfo="*"
              helperText={lang.tr('admin.workspace.template.create.descHelper')}
            >
              <InputGroup
                id="templateDesc"
                tabIndex={2}
                placeholder={lang.tr('admin.workspace.template.create.descPlaceholder')}
                minLength={0}
                value={this.state.desc}
                onChange={this.handleDescChanged}
              />
            </FormGroup>
          </div>
          <div className={Classes.DIALOG_FOOTER}>
            {!!this.state.error && <p className="text-danger">{this.state.error}</p>}
            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
              <Button
                id="btn-modal-create-template"
                type="submit"
                text={
                  this.state.isProcessing ? lang.tr('pleaseWait') : lang.tr('admin.workspace.template.create.create')
                }
                onClick={this.createTemplate}
                disabled={this.isButtonDisabled}
                intent={Intent.PRIMARY}
              />
            </div>
          </div>
        </form>
      </Dialog>
    )
  }
}

const mapStateToProps = state => ({
  ...state.bots
})

export default CloneBotModal
