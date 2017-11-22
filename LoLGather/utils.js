const prettyjson = require('prettyjson');
const _ = require('lodash');
const jsonexport = require('jsonexport');
const fs = require('fs');

const prettyLog = function(data, options={}){
	console.log(prettyjson.render(data,options));
}

const updateSummoner = (db, sum) => {
  isSum = db.get('summoner').find({accountId: sum.accountId});
  if (!isSum.value()) {
    console.log('Summoner '+sum.summonerName+' doesn\'t exist, saving!');
    db.get('summoner')
      .push({fetchDate: 0, ...sum})
      .write();
  }
  else {
    isSum.assign(sum).write();
    console.log('Summoner '+sum.summonerName+' already exist, updating!');
  }
}

const addMatches = (db, matches) => {
  matches = _.filter(matches, (m)=>{return (m.queue == 420 || m.queue == 440) })
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

const updateMatch = (db, match) => {
  let isMatch = db.get('match').find({gameId: match.gameId});
  if (isMatch.value()) {
    console.log('Removing old match!');
    db.get('match').remove({gameId: match.gameId}).write();
    if (match.gameDuration >= 16*60) {
      db.get('match')
        .push(match)
        .write();
    }
    else {
      db.get('match')
        .push({gameId: match.gameId, full: true, comment: 'too short'})
        .write();
    }
  }
  else {
    db.get('match')
      .push(match)
      .write();
  }
}

const fetchSummonerMatches = (kayn, db, sum, season, count=()=>{}) => {
  if (Date.now() - sum.fetchDate > 86400000) {
    kayn.Matchlist.by
      .accountID(sum.currentAccountId)
      .query({season})
      .callback(function(err, matchlist) {
        if (matchlist) {
          updateSummoner(db,{...sum, fetchDate: Date.now()});
          addMatches(db,matchlist.matches);
          count();
        }
        else {
          console.log(err);
          count();
        }
      });
  }
  else {
    console.log("Summoner "+sum.summonerName+" already fetched today, skipping!");
    count();
  }
};

const fetchAllSummonersMatches = (kayn, db, season) => {
  var summoners = db.get('summoner').value();
  var count = summoners.length;
  var fetched = 0;
  _.each(summoners, (sum)=>{
    fetchSummonerMatches(kayn, db, sum, season, ()=>{
      fetched+=1;
      console.log("Progress: "+fetched+"/"+count);
    });
  });
};

const fetchFullMatch = (kayn, db, m, count=()=>{}) => {
  if (!m.full) {
    kayn.Match.get(m.gameId)
      .callback(function(err, match) {
        console.log("Match "+match.gameId+" fetched!");
        // _.each(match.participantIdentities, (p)=>{updateSummoner(db, p.player)});
        updateMatch(db, {full: true, ...match});
        count();
      });
  }
  else {
    console.log("Match "+m.gameId+" already fetched, skipping!");    
    count();
  }
};

const fetchAllMatches = (kayn, db) => {
  var matches = db.get('match').value();
  var count = matches.length;
  var fetched = 0;
  console.log("Starting to fetch...");
  _.each(matches, (match)=>{
    fetchFullMatch(kayn, db, match, ()=>{
      fetched+=1;
      console.log("Progress: "+fetched+"/"+count);
    });
  });
};


const exportMatches = (db) => {
  console.log("Formating matches...");
  function filterPlayers(plyrs, team) {
    const leagues = ['','UNRANKED', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
    const lanes = ['','JUNGLE', 'TOP', 'MIDDLE', 'BOTTOM'];
    plyrs = _.filter(plyrs, (p)=>{return p.teamId == team.teamId});
    return _.map(plyrs, (p)=>{
      return [
        p.championId, 
        leagues.indexOf(p.highestAchievedSeasonTier),
        lanes.indexOf(p.timeline.lane)
      ]
    });
  };
  var matches = _.filter(db.get('match').value(), (m)=>{return m.full && m.teams });
  matches = _.map(matches, (m)=>{
    var plyrsA = filterPlayers(m.participants, m.teams[0]);
    var plyrsB = filterPlayers(m.participants, m.teams[1]);
    return {
      queueId: m.queueId,
      seasonId: m.seasonId,
      gameVersion: m.gameVersion,
      teamA: plyrsA,
      teamB: plyrsB,
      win: (m.teams[0].win == "Win" ? 'A' : 'B')
    }
  });
  console.log("Writing csv...");
  jsonexport(matches,function(err, csv){
    if(err) return console.log(err);
    fs.writeFile('./data/matches.csv', csv, (err) => {  
      if (err) return console.log(err);
      console.log('csv saved!');
      console.log("Updating db...");
      // _.each(matches, (m)=>{
      //   db.get('match')
      //     .remove({gameId: m.gameId})
      //   db.get('match')
      //     .push({gameId: m.gameId, full: true, comment: 'exported'})
      // });
      // db.write();
      console.log("All done! :)");
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
  exportMatches
}
