'use strict'

const os = require('os')
const Koa = require('koa')
const pino = require('pino')
const cors = require('koa2-cors')
const serve = require('koa-static')
const urlParse = require('url-parse')
const Sentry = require('@sentry/node')
const session = require('koa-session2')
const { KoaReqLogger } = require('koa-req-logger')
const cacheControl = require('koa-cache-control')

const config = require('../config/config')

const router = require('./middleware/router')

const RedisStore = require('./middleware/redis-session-store')

const sessionMaxAge = config.sessionMaxAge || 6 * 60 * 60 // 6 hours in seconds

Sentry.init({
  dsn: config.sentryDsn,
  serverName: `${os.hostname()}-${process.env.NODE_ENV}`
})

const app = new Koa()

app.on('error', err => {
  Sentry.captureException(err)
})

// logger and errors handler
const pinoLogger = pino({
  useLevelLabels: true,
  timestamp: pino.stdTimeFunctions.unixTime
})
const logger = new KoaReqLogger({
  pinoInstance: pinoLogger,
  alwaysError: true // treat all non-2** http codes as error records in logs
})
app.use(logger.getMiddleware())

// session
const publicUrl = urlParse(config.publicHost)
app.keys = [config.sessionCookieSignKey]
const sessionParams = {
  key: config.sessionCookieName,
  signed: true,
  httpOnly: true,
  domain: publicUrl.hostname,
  maxAge: sessionMaxAge * 1000
}
if (config.redisPort && config.redisHost) {
  sessionParams.store = new RedisStore(config.redisPort, config.redisHost, sessionMaxAge)
}
app.use(session(sessionParams))

// serve statics (mainly for development; in production static must be served by nginx)
app.use(serve(config.staticPath))

// CORS setup
const corsRoutes = ['/auth1/refresh', '/auth1/logout']
app.use(cors({
  origin: function (ctx) {
    if (!corsRoutes.includes(ctx.url)) {
      return false
    }
    if (config.corsValidOrigins.includes('*')) {
      return '*'
    }
    const requestOrigin = ctx.accept.headers.origin
    if (!config.corsValidOrigins.includes(requestOrigin)) {
      return ctx.throw(`${requestOrigin} is not a valid origin`)
    }
    return requestOrigin
  },
  allowMethods: ['GET', 'OPTIONS'],
  maxAge: 5,
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'Accept']
}))

app.use(async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    err.status = err.status || 500
    throw err
  }
})

app.use(router.routes())
app.use(router.allowedMethods())

app.use(cacheControl({
  noCache: true
}))

// server
const port = config.serverPort
const server = app.listen(port, () => {
  pinoLogger.info(`Server listening on port: ${port}`)
})

module.exports = server
