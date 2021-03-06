const cron = require("cron")
const moment = require("moment")
const WeatherApi = require("./weather")
const GitHubHooks = require("./github")

const send_kanbanery_feed = (discord, channel, feeds) => {
  feeds.forEach(feed => {
    // using "<" and ">" around a link to disabled embedding
    const msg = `:triangular_flag_on_post: **${feed.title}**\n${feed.description}\n:point_right: <${feed.task}>\n---------------------------------------------------------------------------`
    discord.send(channel, msg)
  })
}

const gitHubHooksFlox = (discord, channel, secret) => {
  GitHubHooks.register("/hooks/flox", secret, (event, payload) => {
    if (event == "issues" && payload.action == "opened") {
      discord.send(channel, payload.issue.html_url)
    }
  })
}

module.exports = (discord, kanbanery, holiday) => {
  const DISCORD_FLOX_CHANNEL = process.env.DISCORD_FLOX_CHANNEL
  const DISCORD_TRIVIA_CHANNEL = process.env.DISCORD_TRIVIA_CHANNEL
  const DISCORD_FUME_CHANNEL = process.env.DISCORD_FUME_CHANNEL
  const DISCORD_WEATHER_CHANNEL = process.env.DISCORD_WEATHER_CHANNEL

  const { KANBANERY_API_KEY, KANBANERY_HOST, KANBANERY_SUMMARY_COLUMN_ID, PROJECT_ID } = process.env
  const { WEATHER_API_KEY } = process.env
  const { GITHUB_HOOK_PORT, GITHUB_HOOK_SECRET_FLOX } = process.env

  const KANBANERY_BOARD_URL = `https://${KANBANERY_HOST}/projects/${PROJECT_ID}`
  const URL = `${KANBANERY_BOARD_URL}/log/?key=${KANBANERY_API_KEY}`
  const weatherApi = new WeatherApi(WEATHER_API_KEY)

  // GitHubHooks.init().listen(GITHUB_HOOK_PORT)
  // gitHubHooksFlox(discord, DISCORD_FLOX_CHANNEL, GITHUB_HOOK_SECRET_FLOX)

  const notifyHolidays = async (range = 2, unit = "weeks", send_only_if_holidays_are_upcoming = false) => {
    const upcoming = await holiday.next(range, unit)
    if (process.env.NODE_ENV !== "test") {
      console.log(range)
      console.log(unit)
      console.log(upcoming)
    }

    const upcoming_messages = upcoming.map(h => {
      const date_formatted = moment(h.datum).format("DD.MM.YYYY (dddd)")
      return `- ${date_formatted}: ${h.name}` + (h.hinweis != "" ? ` (${h.hinweis})` : "")
    }).join("\n")

    const today = moment().format("DD.MM.YYYY")
    const message = upcoming.length ?
      `Holiday reminder for ${today}! \nFor the next ${range} ${unit} we've got:\n${upcoming_messages}` :
      `Holiday reminder for ${today}! \nFor the next ${range} ${unit} we've got no upcoming holidays.`

    if (!upcoming.length && send_only_if_holidays_are_upcoming) return false
    discord.send(DISCORD_TRIVIA_CHANNEL, message)
  }

  discord.listenTo(/^bot, .*holidays?.*/, async (msg) => {
    if (msg.channel.name !== DISCORD_TRIVIA_CHANNEL) return false

    if (msg.author.bot) return false

    let range, unit

    // keep variables undefined if try fails. let notifyHolidays use its default params
    try {
      range = msg.content.match(/holidays?[^\d]*(\d+)/)[1]
    } catch (e) { /**/ }

    try {
      unit = msg.content.match(/holidays?.*(days?|weeks?|months?)/)[1]
    } catch (e) { /**/ }

    notifyHolidays(range, unit)
  })

  discord.listenTo(/^!help/, async (msg) => {
    if (msg.channel.name !== DISCORD_FUME_CHANNEL) return false

    discord.send(DISCORD_FUME_CHANNEL, `
Fume-Bot interface
  Holidays:
    'bot, next holidays?'
    'bot, holidays for the next 2 months'
    'bot, holiday for the next year'
    'bot, holidays in 2 days'
`)
  })

  // Triggers on the first of every month
  // new cron.CronJob({
  //   name: "kanbanery monthly summary",
  //   cronTime: "00 00 00 01 * *",
  //   start: true,
  //   async onTick() {
  //     const summary = await kanbanery.summary(KANBANERY_HOST, KANBANERY_SUMMARY_COLUMN_ID, KANBANERY_API_KEY)
  //     if (process.env.NODE_ENV !== "test") {
  //       console.log("CronJob triggered: printing kanbanery summary")
  //       console.log(summary)
  //     }
  //     discord.send(DISCORD_FLOX_CHANNEL, summary)
  //   }
  // })

  // Triggers every morning
  // new cron.CronJob({
  //   name: "daily weather report",
  //   cronTime: "00 00 06 * * *",
  //   start: true,
  //   async onTick() {
  //     try {
  //       const report = await weatherApi.report()

  //       if (process.env.NODE_ENV !== "test") {
  //         console.log("CronJob triggered: printing weather report")
  //         console.log(report)
  //       }

  //       discord.send(DISCORD_WEATHER_CHANNEL, report)
  //     } catch (error) {
  //       console.log("daily weather report: something went wrong")
  //       console.log(error)
  //     }
  //   }
  // })

  // Triggers on every sunday
  // new cron.CronJob({
  //   name: "weekly holiday reminder",
  //   cronTime: "00 00 00 * * 0",
  //   start: true,
  //   async onTick() {
  //     if (process.env.NODE_ENV !== "test") {
  //       console.log("CronJob triggered: printing upcoming holidays for the next 4 weeks")
  //     }
  //     notifyHolidays(4, "weeks", true)
  //   }
  // })

  // Run every 5 minutes
  // new cron.CronJob({
  //   name: "flox kanbanery rss feed",
  //   cronTime: "0 */5 * * * *",
  //   start: true,
  //   runOnInit: true,
  //   async onTick() {
  //     if (process.env.NODE_ENV !== "test") {
  //       console.log("fetching...")
  //     }
  //     try {
  //       send_kanbanery_feed(discord, DISCORD_FLOX_CHANNEL, await kanbanery.fetch(URL))
  //     } catch (e) {
  //       console.error("Fetching failed. Reason: ", e)
  //     }
  //     if (process.env.NODE_ENV !== "test") {
  //       console.log("Fetching done.")
  //     }
  //   }
  // })
}
