var prom = require('prom-client'),
    express = require('express'),
    bodyParser = require('body-parser'),
    backend = require('./backend');

const prefix = process.env.PREFIX || '/';
const port = Number(process.env.PORT || 5000);

console.log(`Todo service listening on port ${port} with prefix ${prefix}`);

var router = express.Router();

// ----- The API implementation

var todos = backend(process.env.DATABASE_URL);

function createCallback(res, onSuccess) {
  return function callback(err, data) {
    if (err || !data) {
      res.status(500).send('Something bad happened!');
      return;
    }

    onSuccess(data);
  }
}

function createTodo(req, data) {
  return {
    title: data.title,
    order: data.order,
    completed: data.completed || false,
    url: `${req.protocol}://${req.get('host')}{prefix}/api/${data.id}`
  };
}

function getCreateTodo(req) {
  return function(data) {
    return createTodo(req, data);
  };
}

router.get('/api/', function(req, res) {
  todos.all(createCallback(res, function(todos) {
    res.send(todos.map(getCreateTodo(req)));
  }));
});

router.get('/api/:id', function(req, res) {
  todos.get(req.params.id, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

router.post('/api', function(req, res) {
  todos.create(req.body.title, req.body.order, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

router.patch('/api/:id', function(req, res) {
  todos.update(req.params.id, req.body, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

router.delete('/api/', function(req, res) {
  todos.clear(createCallback(res, function(todos) {
    res.send(todos.map(getCreateTodo(req)));
  }));
});

router.delete('/api/:id', function(req, res) {
  todos.delete(req.params.id, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

// ----- Prometheus metrics

prom.collectDefaultMetrics();
router.get('/metrics', (req, res) => {
	res.set('Content-Type', prom.register.contentType);
	res.end(prom.register.metrics());
});

var app = express();

// ----- Parse JSON requests

app.use(bodyParser.json());

// ----- Allow CORS

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE');
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// ----- Static files for frontend

app.use(prefix, express.static('public'))

app.use(prefix, router);
app.listen(port);

module.exports = app;
