// http://api.bart.gov/docs/overview/index.aspx
// http://api.bart.gov/api/sched.aspx?cmd=depart&orig=MONT&dest=NBRK&date=now&key=MW9S-E7SL-26DU-VV8V&b=2&a=2&l=1
// http://api.bart.gov/api/sched.aspx?cmd=routesched&route=8&key=MW9S-E7SL-26DU-VV8V

var ORIGIN = 'POWL'
// var DESTINATIONS = ['RICH', 'PITT', 'CONC']
var DESTINATION_COLORS = ['#ff0000', '#ffff33']
var DESTINATION_DIRECTION = 'North'
var API_KEY = 'MW9S-E7SL-26DU-VV8V'
var TRAIN_TIME = 26;
var WALKING_TIME = 9;
var MUNI_AGENCY = 'sf-muni';
var MUNI_ROUTE = '10';
var MUNI_STOP = '3003';
var MUNI_DIR = '10_IB1';

var NOW = new Date();

var BART_STATIONS = [
  ["16th Mission", 32, '16TH'],
  ["24th Mission", 30, '24TH'],
  ["Civic Center", 28, 'CIVC'],
  ["Powell", 26, 'POWL'],
  ["Montgomery", 25, 'MONT'],
  ["Embarcadero", 23, 'EMBR'],
  ["West Oakland", 16, 'WOAK'],
  ["12th", 13, '12TH'],
  ["19th", 11, '19TH'],
  ["MacArthur", 8, 'MCAR'],
  ["Ashby", 5, 'ASHB'],
  ["Berkeley", 2, 'DBRK']
]

function addMinutesToNow (minutes) {
  return new Date(NOW.getTime() + minutes*60000);
}

function formatAMPM(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0'+minutes : minutes;
  var strTime = hours + ':' + minutes + ' ' + ampm;
  return strTime;
}

var etdGenerator = {

  bartAdvisoryUrl: 'http://api.bart.gov/api/bsa.aspx?cmd=bsa&date=today&key=' +
    encodeURIComponent(API_KEY),

  requestAdvisories: function() {
    document.getElementById('bart-loading').removeAttribute('class');
    var req = new XMLHttpRequest();
    req.open("GET", this.bartAdvisoryUrl, true);
    req.onload = this.showAdvisories_.bind(this);
    req.send(null);
  },

  showAdvisories_: function (e) {
    var advisories = [];

    var bsas = e.target.responseXML.querySelectorAll('bsa');
    var advisories = [];
    var bsa = null;

    for (var i = 0; i < bsas.length; i++) {
      bsa = bsas[0];
      advisories.push({
        'description': bsa.querySelector('description').childNodes[0].nodeValue
        // , 'type': bsa.querySelector('type').childNodes[0].nodeValue
        // , 'station': bsa.querySelector('station').childNodes[0].nodeValue
        // , 'posted': bsa.querySelector('posted').childNodes[0].nodeValue
        // , 'expires': bsa.querySelector('expires').childNodes[0].nodeValue

      });
    }

    bartAdvisoryEl = document.getElementById('bart-advisory-list');
    while (bartAdvisoryEl.firstChild) bartAdvisoryEl.removeChild(bartAdvisoryEl.firstChild);

    advisories.forEach(function(advisory){
      var advisory_div = document.createElement('span');
      advisory_div.className = 'advisory';
      advisory_div.innerHTML = advisory.description;
      bartAdvisoryEl.appendChild(advisory_div);
    });

    if (!advisories.length) {
      var advisory_div = document.createElement('span');
      advisory_div.className = 'advisory';
      advisory_div.innerHTML = "No BART Advisories";
      bartAdvisoryEl.appendChild(advisory_div);
    }

  },

  bartEtdUrl: 'http://api.bart.gov/api/etd.aspx?cmd=etd&orig=' +
    encodeURIComponent(ORIGIN) +'&key=' + encodeURIComponent(API_KEY),

  requestETD: function() {
    // console.log('requestETD');
    document.getElementById('bart-loading').removeAttribute('class');
    var req = new XMLHttpRequest();
    req.open("GET", this.bartEtdUrl, true);
    req.onload = this.showTrains_.bind(this);
    req.send(null);
  },

  showTrains_: function (e) {

    var trains = [];

    var etds = e.target.responseXML.querySelectorAll('etd');
    for (var i = 0; i < etds.length; i++) {

      var estimates = etds[i].querySelectorAll('estimate');
      for (var j = 0; j < estimates.length; j++) {
        var minutes_raw = estimates[j].querySelector('minutes').childNodes[0].nodeValue;
        trains.push({
          'abbreviation': etds[i].querySelector('abbreviation').childNodes[0].nodeValue,
          'destination': etds[i].querySelector('destination').childNodes[0].nodeValue,
          'hexcolor': estimates[j].querySelector('hexcolor').childNodes[0].nodeValue,
          'minutes': (minutes_raw == 'Leaving') ? 0 : parseInt(minutes_raw),
          'length': parseInt(estimates[j].querySelector('length').childNodes[0].nodeValue),
          'direction': estimates[j].querySelector('direction').childNodes[0].nodeValue
        });
      }
    }

    trains = trains
      .filter(function(t){ return(t.direction == DESTINATION_DIRECTION && DESTINATION_COLORS.indexOf(t.hexcolor) != -1); })
      .sort(function (a, b) {
        return a.minutes - b.minutes;
    });

    bartEl = document.getElementById('bart-trains');
    while (bartEl.firstChild) bartEl.removeChild(bartEl.firstChild);

    trains.forEach(function(train){
      var train_div = document.createElement('div');
      train_div.className = 'train';
      train_div.innerHTML = '<span class="color" style="background-color:'+ train.hexcolor + '"></span>' +
        ' <span class="minutes">' + train.minutes + '</span>' +
        ' <span class="destination">' + train.destination + '</span>' +
        ' <span class="length">' + train.length + ' car</span>' +
        ' <span class="home-time">' + formatAMPM(addMinutesToNow(train.minutes + TRAIN_TIME + WALKING_TIME)) + '</span>';
      bartEl.appendChild(train_div);
    });

    document.getElementById('bart-loading').setAttribute('class', 'hide');
  }
};

muniGenerator = {
  nextMuni: 'http://webservices.nextbus.com/service/publicXMLFeed?command=predictions&a=' +
  MUNI_AGENCY + '&s=' + MUNI_STOP + '&r=' + MUNI_ROUTE,
// http://www.nextmuni.com/api/pub/v1/agencies/sf-muni/routes/10/stops/3003/predictions?coincident=true&direction=10_IB1&key=bb3c485b3601ea394d768bdf0d0d60d7
  requestMuni: function() {
    // console.log('requestMuni');
    document.getElementById('muni-loading').removeAttribute('class');
    var req = new XMLHttpRequest();
    req.open("GET", this.nextMuni, true);
    req.onload = this.showBuses.bind(this);
    req.send(null);
  },

  showBuses: function (e) {
    var buses = [];
    var preds = e.target.responseXML.querySelectorAll('prediction');
    for (var i = 0; i < preds.length; i++) {
      buses.push('<span class="pred">'+preds[i].getAttribute('minutes')+'</span>');
    }
    var busDiv = document.createElement('div');
    busDiv.className = 'bus';
    if (buses.length) {
      busDiv.innerHTML = '<a href="http://www.nextbus.com/webkit/predsForStop.jsp?a=sf-muni&r=10&d=10_IB1&s=3003&standalone#_predictions">Buses</a> in <span class="preds">' + buses.join(' ' ) +'</span>';
    } else {
      busDiv.innerHTML = 'No buses coming.';
    }
    var muniEl = document.getElementById('muni-buses');
    while (muniEl.firstChild) muniEl.removeChild(muniEl.firstChild);
    muniEl.appendChild(busDiv);
    document.getElementById('muni-loading').setAttribute('class', 'hide');
  }
};

var showBartStationTimes = function () {
  var el = document.getElementById("bart-station-times");
  BART_STATIONS.forEach( function (s) {
    min = s[1] + WALKING_TIME;
    station = document.createElement('li');
    station.innerHTML = '<a href="https://m.bart.gov/schedules/eta?stn=' +
      s[2] + '">' + s[0] + '</a>: ' + min + ' mins';
    el.appendChild(station);
  });

}

var reloadAllTheThings = function () {
  etdGenerator.requestETD();
  etdGenerator.requestAdvisories();
  // muniGenerator.requestMuni();
}

var setup = function () {
  reloadAllTheThings();
  showBartStationTimes();

  document.getElementById("estimate-info").innerHTML = 'Arrival estimates include ' + TRAIN_TIME + ' minutes on train and ' + WALKING_TIME + ' minutes on foot.';

  document.getElementById('reload').addEventListener('click', reloadAllTheThings);
}
document.addEventListener('DOMContentLoaded', setup);

