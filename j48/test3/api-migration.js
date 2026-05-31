var url = 'https://api.example.com';
var options = {
  method: 'GET',
  headers: {}
};
var callback = function (response) {
  logger.info(response);
};
newLib.fetch(url, callback, options);
axios({
  url: '/api/data',
  type: 'POST',
  data: {
    name: 'test'
  },
  success: function (result) {
    logger.info(result);
  }
});
var config = {
  encoding: 'utf-8'
};
fs.promises.readFile('/path/to/file.txt', config);
var message = 'Hello, world!';
logger.info(message);
logger.info('Another message');
console.warn('Warning message');
var result = newLib.fetch('/api/users', function (res) {
  return res.json();
}, {
  method: 'POST'
});
var finalResult = newLib.fetch('/api/final', function (response) {
  return response.ok;
}, {
  method: 'PUT',
  body: JSON.stringify({
    id: 1
  })
});