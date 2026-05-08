/* CSUN MAP QUIXZ-  Google Maps API methods used:
     1. google.maps.Marker  — marks where the user clicked
     2. google.maps.Circle  — highlights the correct/incorrect area  */

/* Locations */
const LOCATIONS = [
    {
        name: "Bookstore",
        center: { lat: 34.237378, lng: -118.528171 },
        radius: 60
    },
    {
        name: "Bayramian Hall",
        center: { lat: 34.2403368, lng: -118.5313077 },
        radius: 60
    },
    {
        name: "Jacaranda Hall",
        center: { lat: 34.2411177, lng: -118.5289256 },
        radius: 60
    },
    {
        name: "Manzanita Hall",
        center: { lat: 34.2377207, lng: -118.5302818 },
        radius: 60
    },
    {
        name: "Baseball Field",
        center: { lat: 34.2452183, lng: -118.5270635 },
        radius: 80
    }
];

/* State variables */
let map;                  // Google Maps instance
let currentIndex = 0;   // which question we're on
let correctCount = 0;   // number of correct answers
let wrongCount = 0;   // number of wrong answers
let circles = [];  // array of google.maps.Circle objects on map
let markers = [];  // array of google.maps.Marker objects on map
let answered = false; // prevents multiple answers per question

// Timer state
let timerInterval = null;
let elapsedSeconds = 0;

// Best time — persisted in localStorage across sessions
let bestTime = localStorage.getItem('csunQuizBestTime')
    ? parseInt(localStorage.getItem('csunQuizBestTime'))
    : null;

// INIT MAP 
/*Called automatically by the Google Maps API script tag via the 
&callback=initMap parameter in index.html */
function initMap() {
    // Create the map centered on CSUN campus
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 34.2414, lng: -118.5289 },
        zoom: 17,
        disableDefaultUI: true,   // hides all default map UI controls
        gestureHandling: 'greedy', // disables mouse/touch panning & zooming
        keyboardShortcuts: false,  // disables keyboard-based zoom/pan
        zoomControl: false,
        scrollwheel: false,
        disableDoubleClickZoom: true    // prevents the map from zooming on dblclick
    });

    // Build the sidebar UI
    buildProgressDots();
    updateBestTimeDisplay();
    loadQuestion();
    startTimer();

    // Listen for the user's double-click answer on the map
    map.addListener('dblclick', function (event) {
        if (answered) return; // guard: ignore extra clicks after answering
        handleAnswer(event.latLng);
    });
}

// Timer Functions 

// Start the countdown timer from zero
function startTimer() {
    elapsedSeconds = 0;
    updateTimerDisplay();
    timerInterval = setInterval(function () {
        elapsedSeconds++;
        updateTimerDisplay();
    }, 1000);
}

// Stop the timer
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

// Update the timer display element
function updateTimerDisplay() {
    var mins = Math.floor(elapsedSeconds / 60);
    var secs = elapsedSeconds % 60;
    $('#timer-display').text(
        (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs
    );
}

// Format a raw seconds value into MM:SS string
function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// Update the best time display in the header
function updateBestTimeDisplay() {
    if (bestTime !== null) {
        $('#best-time-display').text(formatTime(bestTime));
    } else {
        $('#best-time-display').text('--:--');
    }
}

/*  PROGRESS DOTS  */

// Build the 5 progress indicator dots in the sidebar
function buildProgressDots() {
    $('#progress').empty();
    for (var i = 0; i < LOCATIONS.length; i++) {
        var cls = (i === 0) ? 'dot active' : 'dot';
        $('#progress').append(
            '<div class="' + cls + '" id="dot-' + i + '">' + (i + 1) + '</div>'
        );
    }
}

// Update a dot's state to 'correct' or 'wrong' after answering
function updateDot(index, result) {
    $('#dot-' + index)
        .removeClass('active correct wrong')
        .addClass(result);
    // Activate the next dot
    if (index + 1 < LOCATIONS.length) {
        $('#dot-' + (index + 1)).addClass('active');
    }
}

/*  ques mangemnt */

// Load and display the current question
function loadQuestion() {
    answered = false;
    var loc = LOCATIONS[currentIndex];
    $('#current-question').html('Where is <span>' + loc.name + '</span>?');
    addLogEntry('Where is ' + loc.name + '?', 'question');
    $('#feedback').removeClass('correct wrong').hide();
}

/* Handles ans */

// Called when the user double-clicks on the map
function handleAnswer(clickedLatLng) {
    answered = true; // lock out further answers for this question

    var loc = LOCATIONS[currentIndex];
    var center = new google.maps.LatLng(loc.center.lat, loc.center.lng);

    // Calculate distance between user's click and the correct location
    var distance = google.maps.geometry
        ? google.maps.geometry.spherical.computeDistanceBetween(clickedLatLng, center)
        : haversineDistance(clickedLatLng, center); // fallback if geometry not loaded

    var isCorrect = (distance <= loc.radius);


    //  google.maps.Marker 
    // Drop an animated marker where the user clicked
    var clickMarker = new google.maps.Marker({
        position: clickedLatLng,
        map: map,
        title: 'Your click',
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: isCorrect ? '#2ecc71' : '#e74c3c',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
        },
        animation: google.maps.Animation.DROP // marker animates dropping in
    });
    markers.push(clickMarker); // store reference for cleanup on reset


    //  google.maps.Circle 
    // Draw a circle over the correct location (green = correct, red = wrong)
    var circle = new google.maps.Circle({
        map: map,
        center: loc.center,
        radius: loc.radius,
        fillColor: isCorrect ? '#2ecc71' : '#e74c3c',
        fillOpacity: 0.35,
        strokeColor: isCorrect ? '#27ae60' : '#c0392b',
        strokeWeight: 2,
        strokeOpacity: 0.9
    });
    circles.push(circle); // store reference for cleanup on reset


    // Update score and UI
    if (isCorrect) {
        correctCount++;
        showFeedback('Correct!', 'correct');
        addLogEntry('Correct!', 'correct');
        updateDot(currentIndex, 'correct');
    } else {
        wrongCount++;
        showFeedback('Wrong location!', 'wrong');
        addLogEntry('Wrong location.', 'wrong');
        updateDot(currentIndex, 'wrong');
    }

    // Advance to next question or end the game
    currentIndex++;
    if (currentIndex < LOCATIONS.length) {
        setTimeout(loadQuestion, 1200); // short pause before next question
    } else {
        setTimeout(endGame, 1200);
    }
}

/* Feedback Display */

// Show the correct/wrong feedback message in the sidebar
function showFeedback(msg, type) {
    $('#feedback')
        .text(msg)
        .removeClass('correct wrong')
        .addClass(type)
        .show();
}

/* History Log*/

// Append a new entry to the sidebar history list
function addLogEntry(text, cls) {
    var entry = $('<div class="log-entry ' + cls + '">').text(text);
    $('#history').append(entry);
}

/* end game */

function endGame() {
    stopTimer();

    // Check and save best time to localStorage
    var isNewBest = false;
    if (bestTime === null || elapsedSeconds < bestTime) {
        bestTime = elapsedSeconds;
        localStorage.setItem('csunQuizBestTime', bestTime);
        isNewBest = true;
    }

    // Populate and show the final results overlay
    $('#final-correct').text(correctCount);
    $('#final-total').text(LOCATIONS.length);
    $('#final-time').text('Your time: ' + formatTime(elapsedSeconds));

    if (isNewBest) {
        $('#highscore-badge').show();
    } else {
        $('#highscore-badge').hide();
    }

    $('#final-screen').addClass('show');
}

/* play again */

// Reset everything and start a fresh game
$('#play-again').on('click', function () {
    // Reset state
    currentIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    answered = false;

    // Remove all circles and markers from the map
    circles.forEach(function (c) { c.setMap(null); });
    markers.forEach(function (m) { m.setMap(null); });
    circles = [];
    markers = [];

    // Clear history log
    $('#history .log-entry').remove();
    $('#feedback').removeClass('correct wrong').hide();

    // Hide the final screen overlay
    $('#final-screen').removeClass('show');

    // Rebuild UI and restart
    buildProgressDots();
    updateBestTimeDisplay();
    loadQuestion();
    startTimer();
});

/* hAVERSINE fAllback*/
// Manual distance calculation if google.maps.geometry isn't loaded
function haversineDistance(latlng1, latlng2) {
    var R = 6371000; // Earth's radius in meters
    var lat1 = latlng1.lat() * Math.PI / 180;
    var lat2 = latlng2.lat() * Math.PI / 180;
    var dlat = (latlng2.lat() - latlng1.lat()) * Math.PI / 180;
    var dlng = (latlng2.lng() - latlng1.lng()) * Math.PI / 180;
    var a = Math.sin(dlat / 2) * Math.sin(dlat / 2)
        + Math.cos(lat1) * Math.cos(lat2)
        * Math.sin(dlng / 2) * Math.sin(dlng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}