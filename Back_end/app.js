const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const stationsRoute = require('./routes/stations');
const pricesRoute = require('./routes/prices');
const usersRoute = require('./routes/users');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// rotas da API
app.use('/api/stations', stationsRoute);
app.use('/api/prices', pricesRoute);
app.use('/api/users', usersRoute);

// rota simples para checar
app.get('/api/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Backend rodando na porta ${port}`);
});
