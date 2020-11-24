const fs = require('fs')
const fetch = require('node-fetch')
const core = require('@actions/core')
const { Octokit } = require('@octokit/core')

const generateBarChart = require('./chart')
const pace = require('./pace')
const distance = require('./distance')
const goalPercentage = require('./goal')
const time = require('./time')

const {
  RUNNING_GOAL,
  STRAVA_ACCESS_TOKEN,
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REFRESH_TOKEN,
  STRAVA_USER_ID,
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
} = process.env

const goal = RUNNING_GOAL * 1000
const cacheFile = '../auth.json'
const apiBase = 'https://www.strava.com/'
const octokit = new Octokit({ auth: GITHUB_TOKEN })
const owner = GITHUB_REPOSITORY.split('/')[0]
const repo = GITHUB_REPOSITORY.split('/')[1]

function transformData(exercise) {
  const percentage = goalPercentage(exercise.distance, goal)

  return {
    count: exercise.count,
    pace: pace(exercise.distance, exercise.moving_time),
    distance: distance(exercise.distance),
    time: time(exercise.moving_time),
    elevation: exercise.elevation_gain,
    goal: percentage,
    chart: generateBarChart(percentage, 25),
  }
}

async function updateReadme() {
  try {
    const path = core.getInput('path')
    const getReadme = await octokit.request(
      'GET /repos/{owner}/{repo}/contents/{path}',
      {
        owner,
        repo,
        path,
      },
    )
    // const { sha } = getReadme.data

    console.log('README: ', getReadme)
    // const data = core.getInput('customReadmeFile')

    // await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
    //   owner,
    //   repo,
    //   path,
    //   message: '(Automated) Update README.md',
    //   content: Buffer.from(data, 'utf8').toString('base64'),
    //   sha,
    // })
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function getStravaToken() {
  const cache = {
    stravaAccessToken: STRAVA_ACCESS_TOKEN,
    stravaRefreshToken: STRAVA_REFRESH_TOKEN,
  }

  try {
    const jsonStr = fs.readFileSync(cacheFile)
    const c = JSON.parse(jsonStr)

    Object.keys(c).forEach((key) => {
      cache[key] = c[key]
    })
  } catch (error) {
    console.error(error.message)
  }

  const data = await fetch(`${apiBase}oauth/token`, {
    method: 'post',
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: cache.stravaRefreshToken,
    }),
    headers: { 'Content-Type': 'application/json' },
  }).then((res) => res.json())
  cache.stravaAccessToken = data.access_token
  cache.stravaRefreshToken = data.refresh_token

  fs.writeFileSync(cacheFile, JSON.stringify(cache))

  return cache.stravaAccessToken
}

async function getStravaStats() {
  const API = `${apiBase}api/v3/athletes/${STRAVA_USER_ID}/stats?access_token=${await getStravaToken()}`

  const json = await fetch(API).then((data) => data.json())
  return transformData(json.ytd_run_totals)
}

async function main() {
  const stats = await getStravaStats()
  await updateReadme()
  const widget = `Running   ${stats.distance}/120km   ${stats.chart}   ${stats.goal}%`
  console.log(widget)
}

main()
