//@ts-check

/**
 * @module Types
 */

/**
 * A user Object
 * @typedef {Object} user
 * @property {string} username
 * @property {string} rank
 * @property {string} password
 * @property {string} display
 * @property {number} hours
 * @property {boolean} admin
 * @property {string} profileURL
 * @property {string} created
 * @property {string} llogin
 * @property {boolean} cp - Change Password Flag
 * @property {boolean} revoked
 * @property {array} notifications
 */

/**
 * A aircraft Object
 * @typedef {Object} aircraft
 * @property {string} livID
 * @property {string} airID
 * @property {string} livName
 * @property {string} airName
 * @property {string} publicName
 */

/**
 * A event Object
 * @typedef {Object} event
 * @property {string} title
 * @property {string} body
 * @property {string} arrAir
 * @property {string} depAir
 * @property {string} depTime
 * @property {string} air
 * @property {string} airName
 * @property {string} server
 * @property {Array} gates
 */

/**
 * A gate Object
 * @typedef {Object} gate
 * @property {number} id
 * @property {string} event
 * @property {string} gate
 * @property {boolean} taken
 */

/**
 * A notif Object
 * @typedef {Object} notification
 * @property {number} id
 * @property {string} user
 * @property {string} title
 * @property {string} desc
 * @property {string} icon
 * @property {string} timeStamp
 * @property {string} link
 */

/**
 * A operator Object
 * @typedef {Object} operator
 * @property {number} id
 * @property {string} operator
 */

/**
 * A PIREP Object
 * @typedef {Object} PIREP
 * @property {number} id
 * @property {string} vehicle
 * @property {string} vehiclePublic
 * @property {string} author
 * @property {string} airline
 * @property {string} depICAO
 * @property {string} arrICAO
 * @property {string} route
 * @property {number} flightTime
 * @property {string} comments
 * @property {number} fuel
 * @property {string} filed
 */

/**
 * A rank Object
 * @typedef {Object} rank
 * @property {number} minH
 * @property {string} rank
 */

/**
 * A routes Object
 * @typedef {Object} route
 * @property {number} id
 * @property {string} num
 * @property {number} ft - Flight Time
 * @property {string} operator
 * @property {string} aircraft
 * @property {string} depICAO
 * @property {string} arrICAO
 * @property {string} aircraftPublic
 * @property {string} minRank
 */

/**
 * A slot Object
 * @typedef {Object} slot
 * @property {number} id
 * @property {string} route
 * @property {string} depTime
 * @property {string} arrTime
 */

/**
 * A token Object
 * @typedef {Object} token
 * @property {string} token
 * @property {string} user
 */

/**
 * A stat Object
 * @typedef {Object} statistic
 * @property {string} type
 * @property {any} value
 */

//@ts-ignore
module.exports = {user, aircraft, event, gate, notification, operator, PIREP, rank, route, slot, token, statistic}