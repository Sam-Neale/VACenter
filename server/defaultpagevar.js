const _ejs = require('ejs');
// example: global config
let _config = require('../config.json');
setInterval(() => {
    _config = require('../config.json');
}, 5000);


// custom ejs render function
module.exports = function render(filename, payload = {}, cb) {
    // some default page vars
    payload.config = payload.config || _config;
    // resources
    //payload.resources = payload.resources || {};
    // render file
    // you can also pass some ejs lowlevel options
    _ejs.renderFile(filename, payload, {

    }, cb);
}