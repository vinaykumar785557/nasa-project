require('dotenv').config();

const { mongoConnect } = require('../src/services/mongo');
const { loadLaunchData } = require('./models/launches.model');
const app = require('./app');

const http = require('http');

const { loadPlanetsData } = require('./models/planets.model');

const PORT = process.env.PORT || 8000;

const server = http.createServer(app);

async function startServer() {
	await mongoConnect();
	await loadPlanetsData();
	await loadLaunchData();

	server.listen(PORT, () => {
		console.log(`Listening on ${PORT}`);
	});
}

startServer();
