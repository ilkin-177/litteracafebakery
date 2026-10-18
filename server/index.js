const server = require('../server/server.js');

module.exports = (req, res) => {
  server.emit('request', req, res);
};