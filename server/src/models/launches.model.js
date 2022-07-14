const axios = require('axios');

const launchesDatabase = require('./launches.mongo');
const planets = require('./planets.mongo');
// const launches = new Map();

// let latestFlightNumber = 100;
const DEFALUT_FLIGHT_NUMBER = 100;

// const launch = {
// 	flightNumber: 100, // flight_number
// 	launchDate: new Date('December 27,2030'), // date_local
// 	mission: 'Kepler Exploration X', // name
// 	rocket: 'Explorer IS1', // exists as rocket.name
// 	target: 'Kepler-442 b', // not applicable
// 	customers: ['ZTM', 'NASA'], // payload.customers for each payload
// 	upcoming: true, // upcoming
// 	success: true, // success
// };

// saveLaunch(launch);

const SPACEX_API_URL = 'https://api.spacexdata.com/v4/launches/query';

async function populateLaunches() {
	console.log('Downloading launch data');

	const response = await axios.post(SPACEX_API_URL, {
		query: {},
		options: {
			pagination: false,
			populate: [
				{
					path: 'rocket',
					select: {
						name: 1,
					},
				},
				{
					path: 'payloads',
					select: {
						customers: 1,
					},
				},
			],
		},
	});

	if (response.status !== 200) {
		console.log('Problem downloading launch data');
		throw new Error('Launch data download failed');
	}

	const launchDocs = response.data.docs;

	for (const launchDoc of launchDocs) {
		const payloads = launchDoc['payloads'];

		const customers = payloads.flatMap((payload) => {
			return payload['customers'];
		});

		const launch = {
			flightNumber: launchDoc['flight_number'],
			mission: launchDoc['name'],
			rocket: launchDoc['rocket']['name'],
			launchDate: launchDoc['date_local'],
			upcoming: launchDoc['upcoming'],
			success: launchDoc['success'],
			customers: customers,
		};

		console.log(`${launch.flightNumber}  ${launch.mission}`);

		//TODO : populate launches collection

		await saveLaunch(launch);
	}
}

async function loadLaunchData() {
	const firstLaunch = await findLaunch({
		flightNumber: 1,
		rocket: 'Falcon 1',
		mission: 'FalconSat',
	});

	if (firstLaunch) {
		console.log('Launch data already loaded!');
	} else {
		await populateLaunches();
	}
}

// launches.set(launch.flightNumber, launch);
// launches.get(100)

async function findLaunch(filter) {
	return await launchesDatabase.findOne(filter);
}

async function existsLaunchWithId(launchId) {
	// console.log(launches.has(launchId));
	// return launches.has(launchId);

	// return await launchesDatabase.findOne({
	// 	flightNumber: launchId,
	// });

	return await findLaunch({
		flightNumber: launchId,
	});
}

async function getLatestFlightNumber() {
	const latestLaunch = await launchesDatabase.findOne({}).sort('-flightNumber');

	if (!latestLaunch) {
		return DEFALUT_FLIGHT_NUMBER;
	}

	return latestLaunch.flightNumber;
}

async function getAllLaunches(skip, limit) {
	// return Array.from(launches.values());

	return await launchesDatabase
		.find({}, { _id: 0, __v: 0 })
		.sort({ flightNumber: 1 })
		.skip(skip)
		.limit(limit);
}

async function saveLaunch(launch) {
	await launchesDatabase.findOneAndUpdate(
		{
			flightNumber: launch.flightNumber,
		},
		launch,
		{
			upsert: true,
		}
	);
}

async function scheduleNewLaunch(launch) {
	const planet = await planets.findOne({
		keplerName: launch.target,
	});

	if (!planet) {
		throw new Error('No matching planet was found');
	}

	const newFlightNumber = (await getLatestFlightNumber()) + 1;
	const newLaunch = Object.assign(launch, {
		success: true,
		upcoming: true,
		customers: ['ZTM', 'NASA'],
		flightNumber: newFlightNumber,
	});

	await saveLaunch(newLaunch);
}

// function addNewLaunch(launch) {
// 	latestFlightNumber++;
// 	launches.set(
// 		launches.latestFlightNumber,
// 		Object.assign(launch, {
// 			success: true,
// 			upcoming: true,
// 			customers: ['ZTM', 'NASA'],
// 			flightNumber: latestFlightNumber,
// 		})
// 	);
// }

// async function abortLaunchById(launchId) {
// 	// launches.delete(launchId);
// 	// const aborted = launches.get(launchId);
// 	// aborted.upcoming = false;
// 	// aborted.success = false;
// 	// console.log(aborted);
// 	// return aborted;

// 	const aborted = await launchesDatabase.updateOne(
// 		{
// 			flightNumber: launchId,
// 		},
// 		{
// 			upcoming: false,
// 			success: false,
// 		}
// 	);

// 	return aborted.ok === 1 && aborted.nModified === 1;
// }

async function abortLaunchById(launchId) {
	const aborted = await launchesDatabase.updateOne(
		{
			flightNumber: launchId,
		},
		{
			upcoming: false,
			success: false,
		}
	);

	return aborted.modifiedCount === 1;
}

module.exports = {
	loadLaunchData,
	existsLaunchWithId,
	getAllLaunches,
	// addNewLaunch,
	scheduleNewLaunch,
	abortLaunchById,
};
