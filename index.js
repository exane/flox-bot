const kanbanery = require("./kanbanery_feed")
const Discord = require("discord.js")
const client = new Discord.Client()
const trivia = require("./trivia")
const job = require("cron").CronJob
//TODO refactor with DiscordWrapper
const DiscordWrapper = require("./discord")
const Holiday = require("./holidays")

const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const DISCORD_FLOX_CHANNEL = process.env.DISCORD_FLOX_CHANNEL
const DISCORD_TRIVIA_CHANNEL = process.env.DISCORD_TRIVIA_CHANNEL

const { TRIVIA_TIME_LIMIT, TRIVIA_TIME_UNTIL_NEXT_QUESTION_MIN, TRIVIA_TIME_UNTIL_NEXT_QUESTION_MAX } = process.env

const { KANBANERY_API_KEY, KANBANERY_HOST, KANBANERY_BOARD_URL, KANBANERY_SUMMARY_COLUMN_ID } = process.env
const FETCH_INTERVAL = (process.env.FETCH_INTERVAL || 5 * 60) * 1000 // default 5 minutes

const URL = `${KANBANERY_BOARD_URL}/log/?key=${KANBANERY_API_KEY}`
console.log("Flox-Bot start up")
console.log("RSS read interval: %d minutes (%d seconds)", FETCH_INTERVAL / 60 / 1000, FETCH_INTERVAL / 1000)
console.log("Using Kanbanery board: %s", URL)
console.log("Using discord channel for kanbanery: %s", DISCORD_FLOX_CHANNEL)
console.log("Using discord channel for trivia: %s", DISCORD_TRIVIA_CHANNEL)
console.log("Trivia time limit: %s minutes", TRIVIA_TIME_LIMIT / 60)
console.log("Trivia wait until next question: between %s minutes and %s minutes", TRIVIA_TIME_UNTIL_NEXT_QUESTION_MIN / 60, TRIVIA_TIME_UNTIL_NEXT_QUESTION_MAX / 60)

const emotes = {}

const run = async (discord_client) => {
  // init cache
  await kanbanery.fetch(URL)

  try {
    // temp disabled
    if (false && DISCORD_TRIVIA_CHANNEL) {
      trivia.start(discord_client, DISCORD_TRIVIA_CHANNEL, TRIVIA_TIME_LIMIT * 1000, TRIVIA_TIME_UNTIL_NEXT_QUESTION_MIN, TRIVIA_TIME_UNTIL_NEXT_QUESTION_MAX)
    }
  } catch (e) {
    console.error("Trivia start failed. Reason: ", e)
  }

  setInterval(async () => {
    console.log("fetching...")
    try {
      send(await kanbanery.fetch(URL))
    } catch (e) {
      console.error("Fetching failed. Reason: ", e)
    }
  }, FETCH_INTERVAL)

}

const send = (feeds) => {
  feeds.forEach(feed => {
    // using "<" and ">" around a link to disabled embedding
    const msg = `:triangular_flag_on_post: **${feed.title}**\n${feed.description}\n:point_right: <${feed.task}>\n---------------------------------------------------------------------------`
    client.channels.find("name", DISCORD_FLOX_CHANNEL).send(msg)
  })
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`)
  const discord = new DiscordWrapper(client)
  const holiday = new Holiday("SL")

  const notifyHolidays = async (range = 2, unit = "weeks") => {
    const upcoming = await holiday.next(range, unit)
    console.log(range)
    console.log(unit)
    console.log(upcoming)

    const upcoming_message = upcoming.map(h => {
      return `${h.datum}: ${h.name}` + (h.hinweis != "" ? ` (${h.hinweis})` : "")
    }).join("\n- ")
    const message = `Holiday reminder: \nFor the next ${range} ${unit} we've got:\n- ` + (upcoming.length ? upcoming_message : "Nothing :(")

    discord.send(DISCORD_TRIVIA_CHANNEL, message)
  }

  discord.listenTo(/^bot, .*holidays.*/, async (msg) => {
    if (msg.channel.name !== DISCORD_TRIVIA_CHANNEL) return
    if (msg.author.bot) return
    const range = msg.content.match(/holidays.*(\d+)/)[1]
    const unit = msg.content.match(/holidays.*(days?|weeks?|months?)/)[1]

    notifyHolidays(range, unit)
  })

  // Triggers on the first of every month
  new job("00 00 00 01 * *", async () => {
    console.log("CronJob triggered: printing kanbanery summary")
    const summary = await kanbanery.summary(KANBANERY_HOST, KANBANERY_SUMMARY_COLUMN_ID, KANBANERY_API_KEY)
    console.log(summary)
    discord.send(DISCORD_FLOX_CHANNEL, summary)
  }).start()

  // Triggers on every monday
  new job("00 00 00 * * 0", async () => {
    console.log("CronJob triggered: printing upcoming holidays for the next 2 weeks")
    notifyHolidays(2, "weeks")
  }).start()

  try {
    run(client)
  } catch (e) {
    console.error("Fetching failed. Reason: ", e)
  }
})

client.on("message", async (msg) => {
  emotes.feelsGoodMan = emotes.feelsGoodMan || client.emojis.find("name", "feelsGoodMan").toString()
  emotes.feelsBadMan = emotes.feelsBadMan || client.emojis.find("name", "feelsBadMan").toString()

  if (msg.channel.name !== DISCORD_FLOX_CHANNEL || msg.author.bot === true) return
  const content = msg.content
  console.log("Command recognized: %s", content)

  if (content === "!fetch") {
    msg.channel.send(`yo gonna check it out ${emotes.feelsGoodMan}`)

    const feed = await kanbanery.fetch(URL)
    if (feed.length === 0) {
      msg.channel.send(`no mah' dude, nothin' new 'ere ${emotes.feelsBadMan}`)
      return
    }
    send(feed)
  }

  if (content.match(/^say/)) {
    msg.channel.send(content.replace(/^say/, ""))
  }
})

client.login(DISCORD_TOKEN)
