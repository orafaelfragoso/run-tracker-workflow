const fs = require('fs')
const { resolve } = require('path')
const fetch = require('node-fetch')
const core = require('@actions/core')
// const { Octokit } = require('@octokit/core')

const {
  RUNNING_GOAL,
  STRAVA_ACCESS_TOKEN,
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REFRESH_TOKEN,
  STRAVA_USER_ID,
  // GITHUB_TOKEN,
  // GITHUB_REPOSITORY,
} = process.env

const goal = RUNNING_GOAL * 1000
const cacheFile = resolve('../auth.json')
const apiBase = 'https://www.strava.com/'
// const octokit = new Octokit({ auth: GITHUB_TOKEN })
// const owner = GITHUB_REPOSITORY.split('/')[0]
// const repo = GITHUB_REPOSITORY.split('/')[1]

function time(minutes) {
  return `${(minutes / 3600).toFixed(2)}h`
}

function goalPercentage(current, total) {
  return parseFloat(((current / total) * 100).toFixed(2))
}

function generateBarChart(percent, size) {
  const syms = '░▏▎▍▌▋▊▉█'

  const frac = Math.floor((size * 8 * percent) / 100)
  const barsFull = Math.floor(frac / 8)

  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size)
  }

  const semi = frac % 8

  return [syms.substring(8, 9).repeat(barsFull), syms.substring(semi, semi + 1)]
    .join('')
    .padEnd(size, syms.substring(0, 1))
}

function distance(meters) {
  return (meters * 0.001).toFixed(2)
}

function pace(d, movingTime) {
  const pacePH = distance((d * 3600) / (movingTime || 1))
  const p = pacePH.substring(0, pacePH.length - 3)

  return `${p}/h`
}

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
    const readme = fs.readFileSync(path, 'utf8')

    console.log('README: ', readme)
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
    console.log('Reading file: ', cacheFile)
    const jsonStr = fs.readFileSync(cacheFile)
    if (jsonStr) {
      const c = JSON.parse(jsonStr)

      Object.keys(c).forEach((key) => {
        cache[key] = c[key]
      })
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
    })
      .then((res) => res.json())
      .catch((err) => core.setFailed(err.message))

    cache.stravaAccessToken = data.access_token
    cache.stravaRefreshToken = data.refresh_token

    fs.writeFileSync(cacheFile, JSON.stringify(cache))
  } catch (error) {
    console.log('Failed: ', error.message)
  }

  return cache.stravaAccessToken
}

async function getStravaStats() {
  const API = `${apiBase}api/v3/athletes/${STRAVA_USER_ID}/stats?access_token=${await getStravaToken()}`

  const json = await fetch(API)
    .then((data) => data.json())
    .catch((err) => core.setFailed(err.message))
  return transformData(json.ytd_run_totals)
}

async function main() {
  const stats = await getStravaStats()
  await updateReadme()
  const widget = `Running   ${stats.distance}/120km   ${stats.chart}   ${stats.goal}%`
  console.log(widget)
}

;(async () => {
  await main()
})()
