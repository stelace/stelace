// from most recent versions to oldest ones
const apiVersions = [
  '2019-05-20'
]

function transformConfigsIntoChanges (changeConfigs) {
  const changes = []

  changeConfigs.forEach(changeConfig => {
    const versions = Object.keys(changeConfig)

    versions.forEach(version => {
      const rawChanges = changeConfig[version]
      rawChanges.forEach(rawChange => {
        changes.push(
          Object.assign({}, rawChange, { version })
        )
      })
    })
  })

  return changes
}

module.exports = {
  apiVersions,
  transformConfigsIntoChanges
}
