
const fs = require('fs');
const https = require('https');

var projectDir = "/projects/youtube-sync/";
process.chdir(projectDir);

function saveCache(name, data){
    try {
	var cacheDirStats = fs.statSync(projectDir + "cache");
    } catch(ex) {
	fs.mkdirSync(projectDir + 'cache', 0775);
    }
    //this write is async
    fs.writeFile(projectDir + "cache/" + name + ".json", JSON.stringify(data), function(err) {
	if(err) {
	    return console.log("couldn't save "+ name + " data to cache.", err);
	}
	console.log("Updated cache " + name);
    });
};

function retrieveCache(name){
    try {
	var cachecontents = fs.readFileSync(projectDir + "cache/" + name + ".json",
					    { encoding:'utf8' });
	return JSON.parse(cachecontents);
    } catch(ex) {
	return null;
    }
};

function fetchEndpoint(url){
    return new Promise(function (fulfill, reject){
	https.get(url, (res) => {
	    //console.log('statusCode:', res.statusCode);
	    //console.log('headers:', res.headers);
	    
	    res.on('data', (d) => {
		var jsonData = JSON.parse(d);
		fulfill(jsonData);
	    });
	    
	}).on('error', (e) => {
	    reject(e);
	});
    });
}

//API Reference: https://developers.google.com/youtube/v3/docs/playlists/list#try-it
var urlList = 'https://www.googleapis.com/youtube/v3/playlists?part=contentDetails&key=AIzaSyDOTC3TT67WqMZa_KtgJ2LGdnyG2No5xOM&channelId=UCH-M2Z5bOm3uyfQuKQbqTaA';


function fetchPlaylistsPage(pageToken, current_playlists){
    return new Promise(function (fulfill, reject){
	var urlToGet = urlList;
	if("undefined" !== typeof(pageToken)){ urlToGet += ("&pageToken=" + pageToken); };
	var playlists = ("undefined" !== typeof(current_playlists)) ? current_playlists : [];
	fetchEndpoint(urlToGet).then(function(jsonData){
	    playlists = playlists.concat(jsonData.items);
	    console.log(playlists.length);
	    if(playlists.length >= jsonData.pageInfo.totalResults){
		fulfill(playlists);
	    } else {
		fetchPlaylistsPage(jsonData.nextPageToken, playlists).then(fulfill, function(){
		    reject('some iteration returned an error')
		});
	    }


/*	    if(playlists.length >= jsonData.pageInfo.totalResults){
		console.log(playlists.length + "/" + jsonData.pageInfo.totalResults);
		fulfill(playlists);
	    } else {
		console.log(playlists.length + "/" + jsonData.pageInfo.totalResults);
		fetchPlaylistsPage(jsonData.nextPageToken, playlists);
		//fulfill(playlists);
	    }*/
	});
    });
}


function workPlaylists(playlists){
    for(var i in playlists){
	var p = playlists[i];
	console.log(p, 2);
    }
}

var playlistsCache = retrieveCache('playlists-last');
if(playlistsCache){
    workPlaylists(playlistsCache);
} else {
    fetchPlaylistsPage().then(function(playlists){
	var nowTime = (new Date()).getTime();
	saveCache('playlists-' + nowTime, playlists);
	fs.symlinkSync(projectDir + 'cache/playlists-'+nowTime+'.json', projectDir + 'cache/playlists-last.json');
	workPlaylists(playlists);
    }, function(err){
	console.log('error:', err);
    });
}
