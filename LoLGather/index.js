const _ = require('lodash');

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
  fetchAllSummonersMatches,
  fetchFullMatch,
  fetchAllMatches,
  exportMatchesPartial,
  exportMatchesCsv
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

// Judaaz -> id: 197393

// kayn.Summoner.by
//   .name('judaaz')
//   .then((sum) => {
//     updateSummoner(sum);
//   })
//   .catch(err => console.error(err));

// _.each(db.get('summoner').value(), (sum)=>(fetchSummonerMatches(sum)) );
// fetchAllSummonersMatches(kayn, 9);
// fetchAllMatches(kayn);
// exportMatchesPartial();
exportMatchesCsv();
