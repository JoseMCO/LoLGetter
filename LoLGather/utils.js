const prettyjson = require('prettyjson');
const _ = require('lodash');
const jsonexport = require('jsonexport');
const fs = require('fs');
const jsonConcat = require("json-concat");

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const sumAdapter = new FileSync('./data/sumDB.json');
const matchAdapter = new FileSync('./data/matchDB.json');
const db = { sum: low(sumAdapter), match: low(matchAdapter)};

const LANES = ['','JUNGLE', 'TOP', 'MIDDLE', 'BOTTOM'];
const LEAGUES = ['','UNRANKED', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
const GAME_LANES = ['BOTTOM100', 'BOTTOM100', 'BOTTOM200', 'BOTTOM200', 'JUNGLE100', 'JUNGLE200', 'MIDDLE100', 'MIDDLE200', 'TOP100', 'TOP200'];

// Set some defaults
db.sum.defaults({ summoner: [] }).write()
db.match.defaults({ match: [] }).write()

const prettyLog = function(data, options={}){
	console.log(prettyjson.render(data,options));
}

const updateSummoner = (sum) => {
  isSum = db.sum.get('summoner').find({accountId: sum.accountId});
  if (!isSum.value()) {
    console.log('Summoner '+sum.summonerName+' doesn\'t exist, saving!');
    db.sum.get('summoner')
      .push({fetchDate: 0, ...sum})
      .write();
  }
  else {
    isSum.assign(sum).write();
    console.log('Summoner '+sum.summonerName+' already exist, updating!');
  }
}

const addMatches = (matches) => {
  const db_match = db.match.get('match');
  matches = _.filter(matches, (m)=>{return (m.queue == 420 || m.queue == 440) })
  var newMatches = [];
  _.each(matches, (match)=>{
    let isMatch = db_match.find({gameId: match.gameId});
    if (!isMatch.value()) {
      newMatches.push({gameId: match.gameId, queueId: match.queue});
    }
    else {
      console.log('Match '+match.gameId+' already exist, skipping!');
    }
  });
  db.match.set('match', db_match.value().concat(newMatches))
    .write();
  // 520026542
}

const updateMatch = (match) => {
  let isMatch = db.match.get('match').find({gameId: match.gameId});
  if (isMatch.value()) {
    console.log('Removing old match!');
    db.match.get('match').remove({gameId: match.gameId}).write();
    var roles = _.map(match.participants, (p)=>{ return p.timeline.lane+p.teamId }).sort();
    if(!_.isEqual(roles, GAME_LANES)){
      db.match.get('match')
        .push({gameId: match.gameId, full: true, comment: 'invalid lanes'})
        .write();
    }
    else if (match.gameDuration < 16*60) {
      db.match.get('match')
        .push({gameId: match.gameId, full: true, comment: 'too short'})
        .write();
    }
    else {
      db.match.get('match')
        .push(match)
        .write();
    }
  }
  else {
    db.match.get('match')
      .push(match)
      .write();
  }
}

const fetchSummonerMatches = (kayn, sum, season, count=()=>{}) => {
  if (Date.now() - sum.fetchDate > 172800000) {
    kayn.Matchlist.by
      .accountID(sum.currentAccountId)
      .query({season})
      .callback(function(err, matchlist) {
        if (matchlist) {
          updateSummoner({...sum, fetchDate: Date.now()});
          addMatches(matchlist.matches);
          count();
        }
        else {
          console.log(err);
          count();
        }
      });
  }
  else {
    console.log("Summoner "+sum.summonerName+" fetched recently (< 48hrs), skipping!");
    count();
  }
};

const fetchAllSummonersMatches = (kayn, season) => {
  var summoners = db.sum.get('summoner').sortBy('fetchDate').value();
  var count = summoners.length;
  var fetched = 0;
  _.each(summoners, (sum)=>{
    fetchSummonerMatches(kayn, sum, season, ()=>{
      fetched+=1;
      console.log("Progress: "+fetched+"/"+count);
    });
  });
};

const fetchFullMatch = (kayn, m, count=()=>{}) => {
  if (!m.full) {
    kayn.Match.get(m.gameId)
      .callback(function(err, match) {
        console.log("Match "+match.gameId+" fetched!");
        // _.each(match.participantIdentities, (p)=>{updateSummoner(p.player)});
        updateMatch({full: true, ...match});
        count();
      });
  }
  else {
    console.log("Match "+m.gameId+" already fetched, skipping!");    
    count();
  }
};

const fetchAllMatches = (kayn) => {
  var matches = db.match.get('match').value();
  var count = matches.length;
  var fetched = 0;
  console.log("Starting to fetch...");
  _.each(matches, (match)=>{
    fetchFullMatch(kayn, match, ()=>{
      fetched+=1;
      console.log("Progress: "+fetched+"/"+count);
    });
  });
};

const exportMatchesPartial = () => {
  console.log('Filtering matches...');
  var matches = _.filter(db.match.get('match').value(), (m)=>{return m.full && m.teams });
  var logged = _.filter(db.match.get('match').value(), (m)=>{return !(m.full && m.teams) });
  var count = [matches.length, 0];
  console.log('Exporting matches...');
  fs.writeFile('./data/partials/matches_'+Date.now()+'_'+matches.length+'.json', JSON.stringify(matches), (err) => {  
    if (err) return console.log(err);
    console.log('Updating DB...');
    _.each(matches, (m)=>{
      logged.push({gameId: m.gameId, full: true, comment: 'exported'});
      count[1]+=1;
    });
    db.match.set('match', logged).write();
    console.log('All done!');
  });
};

const exportMatchesCsv = () => {
  console.log("Merging match files...");
  const dir = './data/partials/';
  var matches = [];
  fs.readdirSync(dir).forEach((file) => {
    if (file.endsWith(".json")) {
      console.log(file);
      matches = matches.concat(JSON.parse(fs.readFileSync(dir+file, 'utf8')));
    }
  });
  matches = _.filter(matches, (m)=>{
    var roles = _.map(m.participants, (p)=>{ return p.timeline.lane+p.teamId }).sort();
    return _.isEqual(roles, GAME_LANES)
  });
  console.log(matches.length+" matches found");
  console.log("Formating matches...");
  function filterPlayers(plyrs, team, m) {
    var second = false;
    plyrs = _.filter(plyrs, (p)=>{return p.teamId == team.teamId});
    return _.map(plyrs, (p)=>{
      var key = team.teamId+'_'+p.timeline.lane+'_';
      if(p.timeline.lane == 'BOTTOM' && !second){
        key = key+'2_';
        second = true;
      }
      return {
        [key+'champ']: p.championId, 
        [key+'rank']: LEAGUES.indexOf(p.highestAchievedSeasonTier),
      }
    });
  };
  matches = _.map(matches, (m)=>{
    var plyrsA = filterPlayers(m.participants, m.teams[0],m);
    var plyrsB = filterPlayers(m.participants, m.teams[1],m);
    return {
      gameId: m.gameId,
      queueId: m.queueId,
      seasonId: m.seasonId,
      gameVersion: m.gameVersion,
      gameDuration: m.gameDuration,
      ...plyrsA[0],
      ...plyrsA[1],
      ...plyrsA[2],
      ...plyrsA[3],
      ...plyrsA[4],
      ...plyrsB[0],
      ...plyrsB[1],
      ...plyrsB[2],
      ...plyrsB[3],
      ...plyrsB[4],
      win: (m.teams[0].win == "Win" ? 1 : 0)
    }
  });
  console.log("Writing csv...");
  jsonexport(matches,function(err, csv){
    if(err) return console.log(err);
    fs.writeFile('./data/matches.csv', csv, (err) => {  
      if (err) return console.log(err);
      console.log('csv saved!');
    });
  });
};


module.exports = {
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
};