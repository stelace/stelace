module.exports = (Base) => class Rating extends Base {
  static get idPrefix () {
    return 'eml'
  }

  static getAccessFields (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'updatedDate',
        'messageId',
        'eventDate',
        'eventType',
        'clickedUrl',
        'country',
        'region',
        'userAgent',
        'email',
        'rejectReason',

        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static convertDocToEmailLog (doc) {
    return {
      id: doc.id,
      createdDate: doc.createdDate,
      updatedDate: doc.updatedDate,
      transmissionId: setNullIfUndefined(doc.data.transmission_id),
      messageId: setNullIfUndefined(doc.data.message_id),
      eventDate: setNullIfUndefined(new Date(doc.data.timestamp * 1000).toISOString()),
      eventType: setNullIfUndefined(doc.data.type),
      clickedUrl: setNullIfUndefined(doc.data.target_link_url),
      country: setNullIfUndefined(doc.data.geo_ip && doc.data.geo_ip.country),
      region: setNullIfUndefined(doc.data.geo_ip && doc.data.geo_ip.region),
      userAgent: setNullIfUndefined(doc.data.user_agent),
      email: setNullIfUndefined(doc.data.rcpt_to),
      rejectReason: setNullIfUndefined(doc.data.raw_reason),
      metadata: doc.metadata,
      platformData: doc.platformData
    }
  }
}

function setNullIfUndefined (value) {
  return typeof value === 'undefined' ? null : value
}
