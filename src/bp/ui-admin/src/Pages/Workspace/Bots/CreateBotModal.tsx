import { Button, Classes, Dialog, FormGroup, InputGroup, Intent } from '@blueprintjs/core'
import { BotConfig, BotTemplate } from 'botpress/sdk'
import { lang } from 'botpress/shared'
import _ from 'lodash'
import React, { Component } from 'react'
import { connect } from 'react-redux'
import Select from 'react-select'

import api from '../../../api'
import { fetchBotCategories, fetchBotTemplates } from '../../../reducers/bots'

export const sanitizeBotId = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s/g, '-')
    .replace(/[^a-z0-9_-]/g, '')

type SelectOption<T> = { label: string; value: T; __isNew__?: boolean }

interface OwnProps {
  isOpen: boolean
  existingBots: BotConfig[]
  onCreateBotSuccess: () => void
  toggle: () => void
}

interface DispatchProps {
  fetchBotCategories: () => void
  fetchBotTemplates: () => void
}

interface StateProps {
  botCategoriesFetched: boolean
  botTemplatesFetched: boolean
  botTemplates: BotTemplate[]
  botCategories: string[]
}

type Props = DispatchProps & StateProps & OwnProps

interface State {
  telegramToken: string
  botId: string
  botName: string
  isProcessing: boolean
  generateId: boolean

  error: any

  templates: any
  categories: SelectOption<string>[]

  selectedTemplate?: BotTemplate
  selectedCategory?: SelectOption<string>
}

const defaultState = {
  telegramToken: '',
  botId: '',
  botName: '',
  selectedCategory: undefined,
  selectedTemplate: undefined,
  error: undefined,
  isProcessing: false,
  generateId: true
}

class CreateBotModal extends Component<Props, State> {
  private _form: HTMLFormElement | null = null

  state: State = {
    templates: [],
    categories: [],
    ...defaultState
  }

  componentDidMount() {
    this.loadCategories()
    this.loadTemplates()
  }

  componentDidUpdate(prevProps: Props) {
    if (!prevProps.botTemplatesFetched && this.props.botTemplatesFetched) {
      this.loadTemplates()
    }
    if (!prevProps.botCategoriesFetched && this.props.botCategoriesFetched) {
      this.loadCategories()
    }
  }

  loadCategories() {
    if (!this.props.botCategoriesFetched) {
      return this.props.fetchBotCategories()
    }

    const categories = this.props.botCategories.map(x => ({ value: x, label: x }))
    this.setState({ categories, selectedCategory: undefined })
  }

  loadTemplates() {
    if (!this.props.botTemplatesFetched) {
      return this.props.fetchBotTemplates()
    }

    const templatesByModule = _.groupBy(this.props.botTemplates, 'moduleName')
    const groupedOptions = _.toPairs(templatesByModule).map(g => ({ label: g[0], options: g[1] }))

    this.setState({ templates: groupedOptions, selectedTemplate: undefined })
  }

  handleNameChanged = e => {
    const botName = e.target.value
    this.setState({ botName, botId: this.state.generateId ? sanitizeBotId(botName) : this.state.botId })
  }

  handleBotIdChanged = e => this.setState({ botId: sanitizeBotId(e.target.value), generateId: false })
  handleTelegramTokenChanged = e => this.setState({ telegramToken: e.target.value })
  createBot = async e => {
    e.preventDefault()
    if (this.isButtonDisabled) {
      return
    }
    this.setState({ isProcessing: true })

    const newBot = {
      id: this.state.botId,
      name: this.state.botName,
      telegramToken: this.state.telegramToken,
      template: _.pick(this.state.selectedTemplate, ['id', 'moduleId']),
      category: this.state.selectedCategory && this.state.selectedCategory.value
    }

    try {
      await api.getSecured().post(`/admin/bots`, newBot)
      this.props.onCreateBotSuccess()
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
    const { isProcessing, botId, botName, selectedTemplate } = this.state
    const isNameOrIdInvalid =
      !botId ||
      !botName ||
      (this.props.existingBots && this.props.existingBots.some(bot => bot.name === botName || bot.id === botId))
    return isNameOrIdInvalid || isProcessing || !selectedTemplate || !this._form || !this._form.checkValidity()
  }

  render() {
    return (
      <Dialog
        title={lang.tr('admin.workspace.bots.create.newBot')}
        icon="add"
        isOpen={this.props.isOpen}
        onClose={this.toggleDialog}
        transitionDuration={0}
        canOutsideClickClose={false}
      >
        <form ref={form => (this._form = form)}>
          <div className={Classes.DIALOG_BODY}>
            <FormGroup
              label={lang.tr('admin.workspace.bots.create.name')}
              labelFor="bot-name"
              labelInfo="*"
              helperText={lang.tr('admin.workspace.bots.create.nameHelper')}
            >
              <InputGroup
                id="input-bot-name"
                tabIndex={1}
                placeholder={lang.tr('admin.workspace.bots.create.namePlaceholder')}
                minLength={3}
                required
                value={this.state.botName}
                onChange={this.handleNameChanged}
                autoFocus
              />
            </FormGroup>

            <FormGroup
              label={lang.tr('admin.workspace.bots.create.id')}
              labelFor="botid"
              labelInfo="*"
              helperText={lang.tr('admin.workspace.bots.create.idHelper')}
            >
              <InputGroup
                id="botid"
                tabIndex={2}
                placeholder={lang.tr('admin.workspace.bots.create.idPlaceholder')}
                minLength={3}
                required
                value={this.state.botId}
                onChange={this.handleBotIdChanged}
              />
            </FormGroup>

            <FormGroup
              label={lang.tr('admin.workspace.bots.create.id')}
              labelFor="telegram-token"
              labelInfo="*"
              helperText={lang.tr('admin.workspace.bots.create.idHelper')}
            >
              <InputGroup
                id="telegram-token"
                tabIndex={2}
                placeholder={lang.tr('admin.workspace.bots.create.telegramTokenPlaceholder')}
                minLength={0}
                value={this.state.telegramToken}
                onChange={this.handleTelegramTokenChanged}
              />
            </FormGroup>

            {this.state.templates.length > 0 && (
              <FormGroup label={lang.tr('admin.workspace.bots.create.template')} labelFor="template">
                <Select
                  id="select-bot-templates"
                  tabIndex="3"
                  options={this.state.templates}
                  value={this.state.selectedTemplate}
                  onChange={selectedTemplate => this.setState({ selectedTemplate: selectedTemplate as any })}
                  getOptionLabel={o => o.name}
                  getOptionValue={o => o.id}
                />
              </FormGroup>
            )}
            {this.state.categories.length > 0 && (
              <FormGroup label={lang.tr('admin.workspace.bots.create.category')}>
                <Select
                  tabIndex="4"
                  options={this.state.categories}
                  value={this.state.selectedCategory}
                  onChange={selectedCategory => this.setState({ selectedCategory: selectedCategory as any })}
                />
              </FormGroup>
            )}
          </div>
          <div className={Classes.DIALOG_FOOTER}>
            {!!this.state.error && <p className="text-danger">{this.state.error}</p>}
            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
              <Button
                id="btn-modal-create-bot"
                type="submit"
                text={this.state.isProcessing ? lang.tr('pleaseWait') : lang.tr('admin.workspace.bots.create.create')}
                onClick={this.createBot}
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

const mapDispatchToProps = {
  fetchBotTemplates,
  fetchBotCategories
}

export default connect<StateProps, DispatchProps, OwnProps>(mapStateToProps, mapDispatchToProps)(CreateBotModal)
