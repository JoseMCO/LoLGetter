const {prettyLog } = require('./utils');
const _ = require('lodash');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('db.json');
const db = low(adapter);

const {
  Kayn,
  REGIONS,
  METHOD_NAMES,
  BasicJSCache,
  RedisCache,
} = require('kayn');

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

const addSummoner = (sum) => {
  isSum = db.get('summoner').find({id: sum.id});
  if (!isSum.value()) {
    console.log('Summoner '+sum.name+' doesn\'t exist, saving!');
    db.get('summoner')
      .push({...sum, fetchDate: 0})
      .write();
  }
  else {
    console.log('Summoner '+sum.name+' already exist, skipping!');
  }
}

const addMatches = (matches) => {
  _.each(matches, (match)=>{
    let isMatch = db.get('match').find({gameId: match.gameId});
    if (!isMatch.value()) {
      db.get('match')
        .push(match)
        .write();
    }
    else {
      console.log('Match '+match.gameId+' already exist, skipping!');
    }
  });
}

const updateMatch = (match) => {
  let isMatch = db.get('match').find({gameId: match.gameId});
  if (!isMatch.value()) {
    isMatch.assign(match).write();
  }
  else {
    db.get('match')
      .push(match)
      .write();
  }
}

const fetchSummonerMatches = (sum) => {
  kayn.Matchlist.by
    .accountID(sum.accountId)
    .query({season: 9})
    .callback(function(err, matchlist) {
      addMatches(matchlist.matches);
    });
}

const fetchFullMatch = (match) => {
  kayn.Match.get(match.gameId)
    .callback(function(err, newMatch) {
      prettyLog(newMatch);
      updateMatch(newMatch);
    });
}

// Judaaz -> id: 197393

// kayn.Summoner.by
//   .name('frogwithseizure')
//   .then((sum) => {
//     addSummoner(sum);
//     fetchSummonerMatches(sum);
//   })
//   .catch(err => console.error(err));

_.each(db.get('match').value(), (match)=>(fetchFullMatch(match)) );