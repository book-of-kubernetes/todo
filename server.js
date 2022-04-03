var prom = require('prom-client'),
    express = require('express'),
    bodyParser = require('body-parser'),
    backend = require('./backend');

const prefix = process.env.PREFIX || '/';
const port = Number(process.env.PORT || 5000);

console.log(`Todo service listening on port ${port} with prefix ${prefix}`);

var router = express.Router();

// ----- Metrics counters
const success = new prom.Counter({ name: 'api_success', help: 'Successful responses' });
const failure = new prom.Counter({ name: 'api_failure', help: 'Failed responses' });
const getAll = new prom.Counter({ name: 'api_retrieve_all', help: 'Retrieve all items' });
const getOne = new prom.Counter({ name: 'api_retrieve_id', help: 'Retrieve single item' });
const create = new prom.Counter({ name: 'api_create', help: 'Create item' });
const update = new prom.Counter({ name: 'api_update', help: 'Update item' });
const remove = new prom.Counter({ name: 'api_remove', help: 'Remove item' });
const clear = new prom.Counter({ name: 'api_clear', help: 'Clear items' });

// ----- The API implementation

var backendConfig = {};
if (process.env.DATABASE_URL) {
  backendConfig.connectionString = process.env.DATABASE_URL;
}

var todos = backend(backendConfig);

function createCallback(res, onSuccess) {
  return function callback(err, data) {
    if (err || !data) {
      failure.inc();
      res.status(500).send('Something bad happened!');
      return;
    }

    success.inc();
    onSuccess(data);
  }
}

function createTodo(req, data) {
  var apiPath = prefix.endsWith('/') ? `${prefix}api` : `${prefix}/api`;
  return {
    title: data.title,
    order: data.order,
    completed: data.completed || false,
    url: `${req.protocol}://${req.get('host')}${apiPath}/${data.id}`
  };
}

function getCreateTodo(req) {
  return function(data) {
    return createTodo(req, data);
  };
}

router.get('/api/', function(req, res) {
  getAll.inc();
  todos.all(createCallback(res, function(todos) {
    res.send(todos.map(getCreateTodo(req)));
  }));
});

router.get('/api/:id', function(req, res) {
  getOne.inc();
  todos.get(req.params.id, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

router.post('/api', function(req, res) {
  create.inc();
  todos.create(req.body.title, req.body.order, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

router.patch('/api/:id', function(req, res) {
  update.inc();
  todos.update(req.params.id, req.body, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

router.delete('/api/', function(req, res) {
  remove.inc();
  todos.clear(createCallback(res, function(todos) {
    res.send(todos.map(getCreateTodo(req)));
  }));
});

router.delete('/api/:id', function(req, res) {
  clear.inc();
  todos.delete(req.params.id, createCallback(res, function(todo) {
    res.send(createTodo(req, todo));
  }));
});

// ----- Prometheus metrics

prom.register.setDefaultLabels({
  app: 'todo'
})

prom.collectDefaultMetrics();
router.get('/metrics', (req, res) => {
  prom.register.metrics().then(function(metrics) {
    res.set('Content-Type', prom.register.contentType);
    res.send(metrics);
    res.end();
  }).catch(function(err) {
    res.status(500).send('Something bad happened!');
    return;
  });
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
