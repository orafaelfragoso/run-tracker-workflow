const d = require('./distance')

function pace(distance, movingTime) {
  const pacePH = d((distance * 3600) / (movingTime || 1))
  const p = pacePH.substring(0, pacePH.length - 3)

  return `${p}/h`
}

module.exports = pace
