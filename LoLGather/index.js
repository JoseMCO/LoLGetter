const _ = require('lodash');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('./data/db.json');
const db = low(adapter);

const {
  Kayn,
  REGIONS,
  METHOD_NAMES,
  BasicJSCache,
  RedisCache,
} = require('kayn');

const {
  prettyLog,
  updateSummoner,
  addMatches,
  updateMatch,
  fetchSummonerMatches,
  fetchFullMatch,
  fetchAllMatches,
  exportMatches
} = require('./utils');

const kayn = Kayn()({
  region: 'las',
  debugOptions: {
    isEnabled: true,
    showKey: false,
  },
  requestOptions: {
    shouldRetry: true,
    numberOfRetriesBeforeAbort: 3,
    delayBeforeRetry: 1000,
    burst: false,
  },
  cacheOptions: {
    cache: null,
    ttls: {}, 
  },
});

// Set some defaults
db.defaults({ summoner: [], match: [] })
  .write()

// Judaaz -> id: 197393

// kayn.Summoner.by
//   .name('judaaz')
//   .then((sum) => {
//     updateSummoner(sum);
//   })
//   .catch(err => console.error(err));

// _.each(db.get('summoner').value(), (sum)=>(fetchSummonerMatches(sum)) );
// fetchAllMatches(kayn, db);
exportMatches(db);
