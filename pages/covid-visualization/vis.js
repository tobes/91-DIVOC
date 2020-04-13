var _rawData = null;
var _popData = null;
var dateColumns = [];
var _client_width = -1;
var _intial_load = true;

// Resize
$(window).resize(function () {
  if (_rawData != null) {
    var new_width = $("#sizer").width();
    if (_client_width != new_width) {
      render( charts['countries'] );
      render( charts['states'] );
      render( charts['countries-normalized'] );
      render( charts['states-normalized'] );
    }
  }
});


// reducers
var reducer_sum_with_key = function(result, value, key) {
  if (!result[key]) { result[key] = {} }
  let obj = result[key];

  let date = value["Date"];

  if (!obj[date]) { obj[date] = { active: 0, recovered: 0, deaths: 0, cases: 0 } }
  obj[date].active += value["Active"];
  obj[date].recovered += value["Recovered"];
  obj[date].deaths += value["Deaths"];
  obj[date].cases += value["Confirmed"];

  return result;
};

var reducer_byUSstate = function(result, value, key) {
  country = value["Country_Region"];
  state = value["Province_State"];

  if (state == "") { return result; }
  if (country != "United States") { return result; }
  if (state.indexOf("Princess") != -1) { return result; }

  // Use the state name as key
  key = state;
  return reducer_sum_with_key(result, value, key);
};

var reducer_byCountry = function(result, value, key) {
  state = value["Province_State"];
  if (state != "") { return result; }

  key = value["Country_Region"];
  return reducer_sum_with_key(result, value, key);
};


// use a cookie to store country data
// - src: https://www.w3schools.com/js/js_cookies.asp
function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
  var expires = "expires="+d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
  var name = cname + "=";
  var ca = document.cookie.split(';');
  for(var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

// find default state value
var stored;

var defaultState = "New York";
if ((stored = getCookie("state")) != "") { defaultState = stored; }

var defaultCountry = "United States";
if ((stored = getCookie("country")) != "") { defaultCountry = stored; }


// chart metadata
var charts = {
  'countries': {
    reducer: reducer_byCountry,
    scale: "log",
    highlight: defaultCountry,
    y0: 100,
    xCap: 25,
    id: "chart-countries",
    normalizePopulation: false,
    show: 50,
    sort: function (d) { return -d.maxCases; },
    dataSelection: 'cases',
    showDelta: false,
    dataSelection_y0: { 'active': 100, 'cases': 100, 'deaths': 10, 'recovered': 100, 'new-cases': 1 },
    yAxisScale: 'fixed',
    xMax: null, yMax: null, data: null,
    init: false,
    trendline: "default"
  },
  'states': {
    reducer: reducer_byUSstate,
    scale: "log",
    highlight: defaultState,
    y0: 20,
    xCap: 40,
    id: "chart-states",
    normalizePopulation: false,
    show: 9999,
    sort: function (d) { return -d.maxCases; },
    dataSelection: 'cases',
    dataSelection_y0: { 'active': 20, 'cases': 20, 'deaths': 5, 'recovered': 20 },
    yAxisScale: 'fixed',
    xMax: null, yMax: null, data: null,
    init: false,
    trendline: "default"
  },

  'countries-normalized': {
    reducer: reducer_byCountry,
    scale: "log",
    highlight: defaultCountry,
    y0: 1,
    xCap: 25,
    id: "chart-countries-normalized",
    normalizePopulation: "country",
    show: 50,
    sort: function (d) { return -d.maxCases + -(d.pop / 1e2); },
    dataSelection: 'cases',
    dataSelection_y0: { 'active': 1, 'cases': 1, 'deaths': 1, 'recovered': 1 },
    yAxisScale: 'fixed',
    xMax: null, yMax: null, data: null,
    init: false,
    trendline: "default"
  },
  'states-normalized': {
    reducer: reducer_byUSstate,
    scale: "log",
    highlight: defaultState,
    y0: 1,
    xCap: 40,
    id: "chart-states-normalized",
    normalizePopulation: "state",
    show: 9999,
    sort: function (d) { return -d.maxCases; },
    dataSelection: 'cases',
    dataSelection_y0: { 'active': 1, 'cases': 1, 'deaths': 1, 'recovered': 1 },
    yAxisScale: 'fixed',
    xMax: null, yMax: null, data: null,
    init: false,
    trendline: "default"
  },
};


var findNextExp = function(x) {
  return x * 1.5;
  /*
  var pow10 = Math.pow(10, Math.ceil( Math.log10(x) ));

  var val;
  if (x < pow10 / 2) { val = pow10 / 2; }
  else { val = pow10; }

  if (x > 0.8 * val) { val *= 1.5; }
  return val;
  */
};

var prep_data = function(chart) {
  var caseData = chart.fullData;

  if (chart.show < 9999) { caseData = _.take(caseData, chart.show); }
  var countries = _.map(caseData, 'country').sort();

  // ensure highlighted country shows when new page load with cookie
  if (_intial_load && countries.indexOf(chart.highlight) == -1) {
    caseData = chart.fullData;
    countries = _.map(caseData, 'country').sort();
  }

  var $highlight = $("#highlight-" + chart.id);
  $highlight.html("");

  if (countries.indexOf(chart.highlight) == -1) {
    if (chart.id.indexOf("states") == -1) { chart.highlight = "United States"; }
    else { chart.highlight = "New York"; }
  }

  $.each(countries, function() {
    var el = $("<option />").val(this).text(this);
    if (chart.highlight == this) { el.attr("selected", true); }
    $highlight.append(el);
  });

  $highlight.change(function (e) {
    var val = $(e.target).val()
    chart.highlight = val;

    if (chart.id.indexOf("countries") != -1) { setCookie('country', val, 30); }
    if (chart.id.indexOf("states") != -1) { setCookie('state', val, 30); }
    render(chart);
  });

  chart.data = caseData;
  
  casesMax = _.sortBy(chart.data, function(d) { return -d.maxCases; } )[0];
  chart.yMax = findNextExp(casesMax.maxCases);

  return chart;
};


var process_data = function(data, chart) {
  var agg = _.reduce(data, chart.reducer, {});

  var caseData = [];
  var maxDayCounter = 0;  
  
  for (var country in agg) {
    var popSize = -1;
    if (chart.normalizePopulation) {
      popSize = _popData[chart.normalizePopulation][country];

      if (!popSize && location.hostname === "localhost") {
        console.log("Missing " + chart.normalizePopulation + ": " + country);
      }
    } 

    dayCounter = -1;
    maxCases = 0;
    maxDay = -1;
    lastDayCases = -1;
    countryData = [];
    var dataIndex = 0;
    var dates = Object.keys(agg[country])
    for (var i = 0; i < dates.length; i++) {
      date = dates[i];
      // Start counting days only after the first day w/ 100 cases:
      //console.log(agg[country][date]);
      var cases = agg[country][date][chart.dataSelection];
      if (chart.normalizePopulation) { cases = (cases / popSize) * 1e6; }

      if (chart.showDelta) {
        if (i == 0) { cases = 0; }
        else {
          prevCases = agg[country][dates[i - 1]][chart.dataSelection];
          if (chart.normalizePopulation) {
            cases = agg[country][date][chart.dataSelection];
            cases = cases - prevCases;
            cases = (cases / popSize) * 1e6;
          } else {
            cases = cases - prevCases;
          }
        }
      }

      if (dayCounter == -1 && cases >= chart.y0) {
        dayCounter = 0;
      }

      
      // Once we start counting days, add data
      if (dayCounter > -1) {
        //if (cases >= chart.y0 || (chart.showDelta && cases > 1)) {
        if (cases >= chart.y0 || chart.showDelta) {
          countryData.push({
            pop: popSize,
            country: country,
            dayCounter: dayCounter,
            date: date,
            cases: cases,
            i: dataIndex++
          });

          if (!(chart.showDelta && cases < 1)) {
            lastDayCases = cases;
            maxDay = dayCounter;  
          }
        }
        if (cases > maxCases) { maxCases = cases; }

        dayCounter++;
      }
    }

    if (maxDay > 0) {
      caseData.push({
        pop: popSize,
        country: country,
        data: countryData,
        maxCases: maxCases,
        maxDay: maxDay,
        lastDayCases: lastDayCases
      });

      if (dayCounter > maxDayCounter) {
        maxDayCounter = dayCounter + 4;
      }
    }
  }
  
  caseData = _.sortBy(caseData, chart.sort);
  chart.fullData = caseData;

  chart.xMax = maxDayCounter;
  if (chart.xMax > 55) { chart.xMax = 55; }

  prep_data(chart);

  return casesMax;
};

var covidData_promise = d3.csv("jhu-data.csv?d=" + _reqStr, function (row) {
  row["Active"] = +row["Active"];
  row["Confirmed"] = +row["Confirmed"];
  row["Recovered"] = +row["Recovered"];
  row["Deaths"] = +row["Deaths"];
  return row;
});

var populationData_promise = d3.csv("wikipedia-population.csv", function (row) {
  row["Population"] = (+row["Population"]);
  return row;
});


var _dataReady = false, _pageReady = false;

var init_selects = function (chart) {
  $('#' + chart.id).next('div.chart-footer').find('select').each(function () {$(this).change()});
  chart.init = true;
}

var tryRender = function () {
  if (_dataReady && _pageReady) {
    process_data(_rawData, charts["countries"]);
    init_selects(charts["countries"]);
    render(charts["countries"]);
    setTimeout(initialRender2, 100);
  }
}

var initialRender2 = function() {
  process_data(_rawData, charts["states"]);
  init_selects(charts["states"]);
  render(charts["states"]);
  
  process_data(_rawData, charts["countries-normalized"]);
  init_selects(charts["countries-normalized"]);
  render(charts["countries-normalized"]);

  process_data(_rawData, charts["states-normalized"]);
  init_selects(charts["states-normalized"]);
  render(charts["states-normalized"]);

  _intial_load = false;
};



Promise.all([covidData_promise, populationData_promise])
  .then(function(result) {
    data = result[0];
    populationData = result[1];
    
    _rawData = data;

    _popData = {country: {}, state: {}};
    for (var pop of populationData) {
      if (pop.Country) { _popData.country[pop.Country] = pop.Population; }
      if (pop.State) { _popData.state[pop.State] = pop.Population; }
    }

    _dataReady = true;
    tryRender();
  })
  .catch(function (err) {
    console.error(err);
    alert("Failed to load data.");
  });





$(function() {
  $(".trendline-select").change(function(e) {
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];
    
    chart.trendline = $(e.target).val();
    //prep_data(chart);
    render(chart);
  });

  $(".yaxis-select").change(function(e) {
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];
    
    chart.yAxisScale = $(e.target).val();
    //prep_data(chart);
    render(chart);
  });

  $(".scaleSelection").mouseup(function(e) {
    var value = $(e.target).data("scale");
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];

    if (chart && chart.scale != value) {
      chart.scale = value;
      render(chart);
    }
  });

  $(".filter-select").change(function (e) {
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];
    
    chart.show = $(e.target).val();
    prep_data(chart);
    render(chart);
  });

  $(".data-select").change(function (e) {
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];
    var value = $(e.target).val();

    if (value == "cases-daily") {
      value = "cases";
      chart.showDelta = true;
    } else if (value == "deaths-daily") {
      value = "deaths";
      chart.showDelta = true;
    } else {
      chart.showDelta = false;
    }
    
    chart.dataSelection = value;
    chart.y0 = chart.dataSelection_y0[value];
    process_data(_rawData, chart);
    render(chart);
  });

  _pageReady = true;
  tryRender();
});


var tip_html = function(chart) {
  return function(d, i) {
    var geometicGrowth = Math.pow(d.cases / chart.y0, 1 / d.dayCounter);
    

    var gData = _.find(chart.data, function (e) { return e.country == d.country }).data;

    var geoGrowth = [];
    if (d.i >= 2) {
      let d0 = gData[i - 1];
      let ggrowth = Math.pow(d.cases / d0.cases, 1 / (d.dayCounter - d0.dayCounter));
      if (isFinite(ggrowth)) {
        geoGrowth.push(`Previous day: <b>${ggrowth.toFixed(2)}x</b> growth`);
      }
    }
    if (d.i >= 8) {
      let d0 = gData[i - 7];
      let ggrowth = Math.pow(d.cases / d0.cases, 1 / (d.dayCounter - d0.dayCounter));
      if (isFinite(ggrowth)) {
        geoGrowth.push(`Previous week: <b>${ggrowth.toFixed(2)}x</b> /day`);
      }
    }
    if (d.i > 0) {
      let d0 = gData[0];
      let ggrowth = Math.pow(d.cases / d0.cases, 1 / (d.dayCounter - d0.dayCounter));
      if (isFinite(ggrowth)) {
        geoGrowth.push(`Previous ${d.dayCounter} days: <b>${ggrowth.toFixed(2)}x</b> /day`);
      }
    }

    var s2 = "";
    if (chart.normalizePopulation) { s2 = " per 1,000,000 people"; }

    var dataLabel = "";
    if (chart.showDelta) { dataLabel = "new "; }

    if (chart.dataSelection == 'cases') { dataLabel += "confirmed cases"; }
    else if (chart.dataSelection == 'active') { dataLabel += "active cases"; }
    else if (chart.dataSelection == 'deaths') { dataLabel += "deaths from COVID-19"; }
    else if (chart.dataSelection == 'recovered') { dataLabel += "recoveries"; }
  
    var s = `<div class="tip-country">${d.country} &ndash; Day ${d.dayCounter}</div>
             <div class="tip-details" style="border-bottom: solid 1px black; padding-bottom: 2px;"><b>${d.cases.toLocaleString("en-US", {maximumFractionDigits: 1})}</b> ${dataLabel}${s2} on ${d.date} (<b>${d.dayCounter}</b> days after reaching ${chart.y0} ${dataLabel}${s2})</div>`;
    
    if (geoGrowth.length > 0) {
      s += `<div class="tip-details"><i><u>Avg. geometric growth</u>:<br>`;
      for (var str of geoGrowth) {
        s += str + "<br>";
      }
      s += `</i></div>`;
    }
    return s;
  }
};


var render = function(chart) {
  if (!chart.init){
    return;
  }
  data_y0 = chart.y0;
  gData = undefined;
  var f = _.find(chart.data, function (e) { return e.country == chart.highlight })
  if (f && (gData = f.data) && gData[0]) {
    if (gData[0].cases) { data_y0 = gData[0].cases; }
  }

  var maxDayRendered = chart.xMax;
  if (f && f.maxDay > maxDayRendered) {
    maxDayRendered = f.maxDay + 3;
  }

  var margin = { top: 10, right: 20, bottom: 40, left: 60 };

  var cur_width = $("#sizer").width();
  _client_width = cur_width;

  var width = cur_width - margin.right - margin.left;
  var height = 500;

  var isSmall = false;
  if (width < 400) {
    height = 300;
    isSmall = true;
  }

  // X-axis scale (days)
  var daysScale = d3.scaleLinear()
                    .domain([0, maxDayRendered])
                    .range([0, width]);

  // Y-axis scale (# of cases)                    
  var casesScale;
  if (chart.scale == "log") { casesScale = d3.scaleLog(); }
  else { casesScale = d3.scaleLinear(); }

  scale_y0 = chart.y0;
  if (chart.showDelta) {
    scale_y0 = 1;
  }

  scale_yMax = chart.yMax;
  if (chart.yAxisScale == "highlight") {
    scale_yMax = f.maxCases * 1.2;
  }

  casesScale.domain([scale_y0, scale_yMax]).range([height, 0]);
  
  // Color Scale
  var colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // SVG
  $("#" + chart.id).html("");
  var svg = d3.select("#" + chart.id)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .style("width", width + margin.left + margin.right)
    .style("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Mouseovers
  var tip = d3.tip().attr('class', 'd3-tip').html(tip_html(chart));
  svg.call(tip);

  // Axes
  var x_axis = d3.axisBottom(daysScale);
  svg.append('g')
     .attr("transform", "translate(0, " + height + ")")
     .attr("class", "axis")
     .call(x_axis);  
  
  var x_grid = d3.axisBottom(daysScale).tickSize(-height).tickFormat("");
  svg.append('g')
     .attr("transform", "translate(0, " + height + ")")
     .attr("class", "grid")
     .call(x_grid);

  // Have tickValues at 1, 5, 10, 50, 100, ...
  var tickValue = 1;
  var tickValueIncrease = 5; 
  var tickValues = [];
  while (tickValue <= 1e6) {
    if (tickValue >= scale_y0) { tickValues.push(tickValue); }
    tickValue *= tickValueIncrease;

    if (tickValueIncrease == 5) { tickValueIncrease = 2; }
    else { tickValueIncrease = 5; }
  }

  var y_axis = d3.axisLeft(casesScale).tickFormat(d3.format("0,")); 
  if (chart.scale == "log") { y_axis.tickValues(tickValues); }
  
  svg.append('g')
    .attr("class", "axis")
    .call(y_axis);  

  var y_grid = d3.axisLeft(casesScale).tickSize(-width).tickFormat("");
  svg.append('g')
     .attr("class", "grid")
     .call(y_grid);
    


  // Add Data
  // Create 35%-line
  let scaleLinesMeta = [];
  if (chart.trendline == "default" || chart.trendline == "35" || chart.trendline == "all") {
    scaleLinesMeta.push({ is35pct: true, dStart: 0, dasharray: 12, label: "35% daily", sLabel: "35%", gRate: 1.35 });
  }

  var getSacleMeta = function(gData, f, dayTrend, dasharray) {
    console.log(gData);
    if (gData.length == 0) { return null; }

    var d = gData[gData.length - 1];
    d0 = _.find(gData, function (e) { return e.dayCounter == d.dayCounter - dayTrend; });

    if (!d0) { return null; }

    let ggrowth = Math.pow(d.cases / d0.cases, 1 / (d.dayCounter - d0.dayCounter));

    let s = ggrowth.toFixed(2) + `x (${dayTrend}-day trend)`;

    return {
      dasharray: dasharray,
      color: colorScale(f.country),
      label: s,
      sLabel: s,
      gRate: ggrowth,
      y0: d.cases / Math.pow(ggrowth, d.dayCounter),
      dStart: d0.dayCounter
    };
  };
  
  if (chart.trendline == "default" || chart.trendline == "highlight-1week" || chart.trendline == "all") {
    var scaleMetadata = getSacleMeta(gData, f, 7, 6);
    if (scaleMetadata) { scaleLinesMeta.push( scaleMetadata ); }
  }

  if (chart.trendline == "highlight-3day" || chart.trendline == "all") {
    var scaleMetadata = getSacleMeta(gData, f, 3, 4);
    if (scaleMetadata) { scaleLinesMeta.push( scaleMetadata ); }
  }

  if (chart.trendline == "highlight-1day" || chart.trendline == "all") {
    var scaleMetadata = getSacleMeta(gData, f, 1, 2);
    if (scaleMetadata) { scaleLinesMeta.push( scaleMetadata ); }
  }

  var xTop_visualOffset = -5;
  for (var scaleLineMeta of scaleLinesMeta) {
    var cases = data_y0, day = 0, y_atMax = -1, y_atStart = -1;
    if (scaleLineMeta.y0) {
      cases = scaleLineMeta.y0;
    }
    var pctLine = [];
    while (day < maxDayRendered + 3) {
      if (day >= scaleLineMeta.dStart) {
        pctLine.push({
          dayCounter: day,
          cases: cases
        })

        if (y_atStart == -1) { y_atStart = cases; }
      }

      if (day == maxDayRendered) { y_atMax = cases; }
      day++;
      cases *= scaleLineMeta.gRate;
    }
  
    svg.datum(pctLine)
      .append("path")
      .attr("fill", "none")
      .attr("stroke", function() {
        if (scaleLineMeta.color) { return scaleLineMeta.color; }
        else { return "black"; }
      })
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", scaleLineMeta.dasharray)
      .attr("d", d3.line()
        .x(function (d) { return daysScale(d.dayCounter); })
        .y(function (d) { return casesScale(d.cases); })
      );
  
    svg.append("text")
      .attr("class", "label-country")
      .attr("x", function() {
        if (y_atMax > scale_yMax) { /* extends off the top */
          return daysScale(
            Math.log( scale_yMax / y_atStart )  / Math.log( scaleLineMeta.gRate ) + scaleLineMeta.dStart
          );
        } else if (y_atMax < scale_y0) { /* extends off bottom */ 
          return daysScale(
            Math.log( 1 / y_atStart ) / Math.log( scaleLineMeta.gRate ) + scaleLineMeta.dStart
          );
        } else { /* extends off right */
          return width;
        }
      })
      .attr("y", function () {
        if (y_atMax > scale_yMax) { /* extends off the top */
          if (!scaleLineMeta.is35pct) { xTop_visualOffset += 10; return xTop_visualOffset; }
          else { return 5; }
          
        } else if (y_atMax < scale_y0) { /* extends off bottom */ 
          return height;
        } else { /* extends off right */
          return casesScale(y_atMax);
        }
      })
      .attr("text-anchor", "end")
      .style("font-size", (isSmall)?"8px":"10px")
      .attr("fill", function() {
        if (scaleLineMeta.color) { return scaleLineMeta.color; }
        else { return "black"; }
      })
      .text(function() {
        return scaleLineMeta.label;
      })
  }
  


  var xAxisLabel = `Days since ${chart.y0} `
  if (chart.dataSelection == 'cases') { xAxisLabel += "case"; if (chart.y0 != 1) { xAxisLabel += "s"; }}
  else if (chart.dataSelection == 'active') { xAxisLabel += "active case"; if (chart.y0 != 1) { xAxisLabel += "s"; }}
  else if (chart.dataSelection == 'deaths') { xAxisLabel += "death"; if (chart.y0 != 1) { xAxisLabel += "s"; } }
  else if (chart.dataSelection == 'recovered') { xAxisLabel += "recover"; if (chart.y0 != 1) { xAxisLabel += "ies"; } else { xAxisLabel += "y"; }}
  if (chart.normalizePopulation) { xAxisLabel += "/1m people"; }
  if (chart.showDelta) { xAxisLabel += "/day"; }

  svg.append("text")
     .attr("x", width - 5)
     .attr("y", height - 5)
     .attr("class", "axis-title")
     .attr("text-anchor", "end")
     .text(xAxisLabel);

  var yAxisLabel = "";
  if (chart.showDelta) { yAxisLabel += "New Daily "; }
  if (chart.dataSelection == 'cases') { yAxisLabel += "Confirmed Cases"; }
  else if (chart.dataSelection == 'active') { yAxisLabel += "Active Cases"; }
  else if (chart.dataSelection == 'deaths') { yAxisLabel += "COVID-19 Deaths"; }
  else if (chart.dataSelection == 'recovered') { yAxisLabel += "Recoveries" }
  if (chart.normalizePopulation) {
    yAxisLabel += "/1m people";
  }

  svg.append("text")
     .attr("transform", "rotate(-90)")
     .attr("x", -2)
     .attr("y", 15)
     .attr("class", "axis-title")
     .attr("text-anchor", "end")
     .text(yAxisLabel);

  svg.append("text")
    .attr("x", width)
    .attr("y", height + 32)
    .attr("class", "text-credits")
    .attr("text-anchor", "end")
    .text(`Data: Johns Hopkins CSSE; Updated: ${_dateUpdated}`);

  last_index = -1;
  for (var i = 0; i < chart.data.length; i++) {
    colorScale(i);
    //console.log(chart.data[i]);
    if (chart.data[i].data[0].country == chart.highlight) {
      last_index = i;
    }
  }

  var renderLineChart = function(svg, i) {
    var countryData = chart.data[i];

    svg.datum(countryData.data)
      .append("path")
      .attr("fill", "none")
      .attr("stroke", function (d) { return colorScale(d[0].country); } )
      .attr("stroke-width", function (d) {
        if (d[0].country == chart.highlight) { return 4; }
        else { return 1; }
      })
      .style("opacity", function (d) {
        if (d[0].country == chart.highlight) { return 1; }
        else { return 0.3; }
      })      
      .attr("d", d3.line()
        .x(function (d) { return daysScale(d.dayCounter); })
        .y(function (d) { return casesScale(d.cases); })
        .defined(function (d, i, a) {
          return (d.cases >= 1);
        })
      );

    svg.selectAll("countries")
      .data(countryData.data)
      .enter()
      .append("circle")
      .attr("cx", function (d) { return daysScale(d.dayCounter); } )
      .attr("cy", function (d) {
        if (d.cases < 1) { return -999; }
        return casesScale(d.cases);
      } )
      .style("opacity", function (d) {
        if (d.country == chart.highlight) { return 1; }
        else { return 0.3; }
      })
      .attr("r", function (d) {
        if (d.cases < 1) { return 0; }
        if (d.country == chart.highlight) { return 4; }
        else { return 3; }
      })
      .attr("fill", function (d) { return colorScale(d.country); })
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide);

    var countryText = svg.append("text")
      .attr("fill", function (d) { return colorScale(countryData.data[0].country); })
      .attr("class", "label-country")
      .style("opacity", function () {
        if (countryData.data[0].country == chart.highlight) { return 1; }
        else { return 0.3; }
      })
      .style("font-size", function () {
        if (countryData.data[0].country == chart.highlight) { return "15px"; }
        else { return null; }
      })
      .text(countryData.country);

    if (countryData.maxDay + 2 < maxDayRendered || !countryData.data[maxDayRendered - 1]) { 
      countryText
        .attr("x", 5 + daysScale(countryData.maxDay) )
        .attr("y", casesScale(countryData.lastDayCases) )
        .attr("alignment-baseline", "middle")
    } else {
      countryText
        .attr("x", daysScale(maxDayRendered) - 5 )
        .attr("y", casesScale(countryData.data[maxDayRendered - 1].cases) - 5 )
        .attr("text-anchor", "end")
    }
  };

  for (var i = 0; i < chart.data.length; i++) {
    if (i != last_index) { renderLineChart(svg, i); }
  }

  if (last_index != -1) {
    renderLineChart(svg, last_index);
  }
};
