import { FlowGeneratorMetadata, Logger } from 'botpress/sdk'
import { UnexpectedError } from 'common/http'
import { ModuleInfo } from 'common/typings'
import { ConfigProvider } from 'core/config/config-loader'
import ModuleResolver from 'core/modules/resolver'
import AuthService, { TOKEN_AUDIENCE } from 'core/services/auth/auth-service'
import { RequestHandler, Router } from 'express'
import _ from 'lodash'
// import { inject } from 'inversify'
import path from 'path'
import fs from 'fs'
import fse from 'fs-extra'

import yn from 'yn'

import { ModuleLoader } from '../module-loader'
import { SkillService } from '../services/dialog/skill/service'

import { CustomRouter } from './customRouter'
import { NotFoundError } from './errors'
import { assertSuperAdmin, checkTokenHeader, success as sendSuccess } from './util'
// import { TYPES } from 'core/types'
// import { ModuleResourceLoader } from 'core/services/module/resources-loader'
// import { inject } from 'inversify'

export class ModulesRouter extends CustomRouter {
  private checkTokenHeader!: RequestHandler

  constructor(
    private logger: Logger,
    private authService: AuthService,
    private moduleLoader: ModuleLoader,
    private skillService: SkillService,
    private configProvider: ConfigProvider // private ghostService: GhostService
  ) {
    super('Modules', logger, Router({ mergeParams: true }))
    this.checkTokenHeader = checkTokenHeader(this.authService, TOKEN_AUDIENCE)
    this.setupRoutes()
  }

  private setupRoutes(): void {
    this.router.get('/', (_req, res) => {
      res.json(this.moduleLoader.getLoadedModules())
    })

    this.router.get(
      '/all',
      this.checkTokenHeader,
      assertSuperAdmin,
      this.asyncMiddleware(async (req, res) => {
        res.send(await this.moduleLoader.getAllModules())
      })
    )

    this.router.post(
      '/:moduleName/unpack',
      this.checkTokenHeader,
      assertSuperAdmin,
      this.asyncMiddleware(async (req, res) => {
        try {
          const moduleInfo = await this._findModule(req.params.moduleName)

          const resolver = new ModuleResolver(this.logger)
          await resolver.resolve(moduleInfo.location)

          res.sendStatus(200)
        } catch (err) {
          throw new UnexpectedError('Could not unpack module', err)
        }
      })
    )

    this.router.post(
      '/:moduleName/enabled/:enabled',
      this.checkTokenHeader,
      assertSuperAdmin,
      this.asyncMiddleware(async (req, res) => {
        const { moduleName } = req.params
        const enabled = yn(req.params.enabled)

        const { location, fullPath } = await this._findModule(moduleName)

        const modules = (await this.configProvider.getBotpressConfig()).modules
        const module = modules.find(x => x.location === location)

        if (module) {
          module.enabled = enabled
        } else {
          modules.push({ location, enabled })
        }

        await this.configProvider.mergeBotpressConfig({ modules })

        // Hot reloading of module is not distributed for now
        if (!process.CLUSTER_ENABLED && !process.IS_PRODUCTION) {
          if (!enabled) {
            await this.moduleLoader.unloadModule(fullPath, moduleName)
          } else {
            await this.moduleLoader.reloadModule(fullPath, moduleName)
            this.logger.info(`Module ${moduleName} reloaded successfully!`)
          }
          return res.send({ rebootRequired: false })
        } else {
          return res.send({ rebootRequired: true })
        }
      })
    )

    this.router.get(
      '/:moduleName/reload',
      this.checkTokenHeader,
      assertSuperAdmin,
      this.asyncMiddleware(async (req, res, _next) => {
        const moduleName = req.params.moduleName
        const config = await this.configProvider.getBotpressConfig()
        const module = config.modules.find(x => x.location.endsWith(moduleName))

        if (module) {
          await this.moduleLoader.reloadModule(module.location, moduleName)
          return res.sendStatus(200)
        }

        res.sendStatus(404)
      })
    )

    this.router.get(
      '/botTemplates',
      this.checkTokenHeader,
      this.asyncMiddleware(async (_req, res, _next) => {
        // let arr = new Array()
        // const templateConfigJson = path.join(__dirname, '../../../../modules/builtin/src/backend/template.config.json')
        // const templateConfigData = await fse.readJson(templateConfigJson, { throws: false })
        // this.logger.info(templateConfigData)
        // for (let i = 0; i < templateConfigData.length; i++) {
        //   let obj = {}
        //   obj['id'] = templateConfigData[i].id
        //   obj['name'] = templateConfigData[i].name
        //   obj['desc'] = templateConfigData[i].desc
        //   obj['moduleId'] = 'builtin'
        //   obj['moduleName'] = 'Botpress Builtins'
        //   arr.push(obj)
        // }
        // origin res.send get bot Template
        res.send(this.moduleLoader.getBotTemplates())
        // new res.send get bot Template
        // res.send(arr)
      })
    )

    this.router.post(
      '/botTemplates',
      this.checkTokenHeader,
      this.asyncMiddleware(async (req, res, _next) => {
        const { botId, name, desc } = req.body
        try {
          // const resourceLoader = new ModuleResourceLoader(this.logger, 'builtin', this.ghostService)
          // const templatePath = await resourceLoader.getBotTemplatePath(req.body.id)
          const dotDirectoryPath = path.join(__dirname, `../../data/bots/${botId}`)
          const templateDirectoryPath = path.join(__dirname, `../../../../modules/builtin/src/bot-templates/${name}`)
          const templateConfigPath = path.join(templateDirectoryPath, `../../backend/template.config.json`)
          if (!fs.existsSync(templateDirectoryPath)) {
            fs.mkdirSync(templateDirectoryPath, { recursive: true })
          }
          // copy content from this folder to template folder
          await fse.copy(dotDirectoryPath, templateDirectoryPath)
          const element = { id: name, name: name, desc: desc || '' }
          fs.readFile(templateConfigPath, 'utf-8', function(err, json) {
            let array = JSON.parse(json)
            array.push(element)
            fs.writeFile(templateConfigPath, JSON.stringify(array), 'utf-8', function(err) {
              if (err) {
                console.log(err)
                return
              }
            })
          })
          return sendSuccess(res, 'Updated Template', {
            message: 'oke',
            botDir: dotDirectoryPath,
            templateDir: templateDirectoryPath
            // ghostService: templatePath
          })
        } catch (err) {
          throw new UnexpectedError('Cannot update Template', err)
        }
      })
    )

    this.router.get(
      '/skills',
      this.checkTokenHeader,
      this.asyncMiddleware(async (_req, res, _next) => {
        res.send(await this.moduleLoader.getAllSkills())
      })
    )

    this.router.post(
      '/:moduleName/skill/:skillId/generateFlow',
      this.checkTokenHeader,
      this.asyncMiddleware(async (req, res) => {
        const flowGenerator = this.moduleLoader.getFlowGenerator(req.params.moduleName, req.params.skillId)
        if (!flowGenerator) {
          return res.status(404).send('Invalid module name or flow name')
        }

        try {
          const metadata: FlowGeneratorMetadata = { botId: req.query.botId, isOneFlow: yn(req.query.isOneFlow) }
          res.send(this.skillService.finalizeFlow(await flowGenerator(req.body, metadata)))
        } catch (err) {
          throw new UnexpectedError('Could not generate flow', err)
        }
      })
    )

    this.router.get(
      '/translations',
      this.checkTokenHeader,
      this.asyncMiddleware(async (_req, res, _next) => {
        res.send(await this.moduleLoader.getTranslations())
      })
    )
  }

  private async _findModule(moduleName: string): Promise<ModuleInfo> {
    const allModules = await this.moduleLoader.getAllModules()
    const module = allModules.find(x => x.name === moduleName)

    if (!module) {
      throw new NotFoundError(`Could not find module ${moduleName}`)
    }

    return module
  }
}
