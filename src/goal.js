function goal(current, total) {
  return parseFloat(((current / total) * 100).toFixed(2))
}

module.exports = goal
