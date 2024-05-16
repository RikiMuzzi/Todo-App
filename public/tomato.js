var isRunning = false;
var firstTime = true;
var studying = true;
var live = false;

var timeLeft = 0;
var sTimeLeft = 0;

var studyInput = 0;
var pauseInput = 0;
var repetitionInput = 0;
var ogRepInput = 0;
var cicli = 0;

var current;
var timerId;

var countdown;
var pauseTimer;

const serverUrl = "http://localhost:3000";


document.querySelector("form").addEventListener("submit", function(e) {
    e.preventDefault();
    if(!live){
        studyInput = parseInt(document.getElementById("studyTime").value);
        pauseInput = parseInt(document.getElementById("pauseTime").value);
        repetitionInput = parseInt(document.getElementById("repTime").value) - cicli;

        if (isNaN(studyInput) || isNaN(pauseInput) || isNaN(repetitionInput)) return;
        if (studyInput === 0 || pauseInput === 0 || repetitionInput === 0) return;
    }

    isRunning = !isRunning;
    live = true;

    var sButton = document.getElementById("startButton");
    if (isRunning) sButton.textContent = "PAUSE";
    else sButton.textContent = "RESUME";
    //sButton.type = "button";

    current = document.getElementById("current");
    if (studying) current.textContent = "STUDYING...";
    else current.textContent = "BREAK!";

    if (isRunning){
        if (studying) {
            if (firstTime) {
                ogRepInput = repetitionInput;
                fetch('/saveTomato', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        studyTime: studyInput,
                        pauseTime: pauseInput,
                        repeat: repetitionInput
                    })
                })
                .then(response => response.json())
                .then(data => {
                    // Aggiorna il timerId con l'ID del timer corrente restituito dal backend
                    timerId = data.timerId; // Assicurati che la variabile timerId venga aggiornata correttamente
                    console.log('Timer ID:', timerId);
                })
                .catch(error => console.error('Errore durante il salvataggio del timer:', error));
                
                firstTime = false;
                startStudy(studyInput, pauseInput);
            } else {
                startStudy(timeLeft, pauseInput);
            }
        } else {
            if (firstTime) {
                firstTime = false;
                startPause(pauseInput, studyInput);
            } else {
                startPause(timeLeft, studyInput);
            }
        }
    } else {
        pauseTomato();
    }
})

function startStudy(time, pauseTime) {
    if (repetitionInput <= 0) {
        var sButton = document.getElementById("startButton");
        document.getElementById("circle2").style.height = 0 + "%"
        sButton.textContent = "START";
        //sButton.type = "submit";
        var percentS = timePercent();
        var totS = totStudyTime();
        current.textContent = "Completed: " + percentS + " %";
        isRunning = false;
        firstTime = true;
        studying = true;
        live = false;

        timeLeft = 0;
        studyInput = 0;
        pauseInput = 0;
        repetitionInput = 0;
        ogRepInput = 0;
        cicli = 0;

        // Aggiorna lo stato del timer nel database
        fetch(`/timers/${timerId}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                liveNow: false, 
                completed: totS,
                percentual: percentS 
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Errore nella richiesta al server');
            }
            console.log('Campi del timer aggiornati con successo');
        })
        .catch(error => {
            console.error('Errore durante la modifica dei campi del timer:', error);
            // Gestisci eventuali errori qui
        });

        return;
    }

    var timer = time * 60;
    var minutes, seconds;

    studying = true;
    current.textContent = "STUDYING...";
    clearTimeout(pauseTimer);

    countdown = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        timerDisplay.textContent = minutes + ":" + seconds;

        var timerPercentage = (studyInput * 60 - timer) / (studyInput * 60);
        document.getElementById("circle2").style.height = (timerPercentage * 100) + "%";

        if (--timer < 0) {
            clearInterval(countdown); 
            setTimeout(function () {
                repetitionInput--;
                cicli++;
                sTimeLeft = 0;
                startPause(pauseTime, studyInput);
                firstTime = true;
            }, 1000); 
        }
        timeLeft = timer / 60;
        sTimeLeft = timeLeft;
    }, 1000);
}

function startPause(time, studyTime) {
    var timer = time* 60;
    var minutes, seconds;

    studying = false;
    current.textContent = "BREAK!";
    clearTimeout(pauseTimer);

    countdown = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        timerDisplay.textContent = minutes + ":" + seconds;

        var timerPercentage = (pauseInput * 60 - timer) / (pauseInput * 60);
        document.getElementById("circle2").style.height = (timerPercentage * 100) + "%";
    
        if (--timer < 0) {
            clearInterval(countdown); 
            setTimeout(function () {
                startStudy(studyTime, pauseInput);
                firstTime = true;
            }, 1000); 
        }
        timeLeft = timer / 60;
    }, 1000);
}

function pauseTomato() {
    firstTime = false;
    clearInterval(countdown);
    clearTimeout(pauseTimer); // Cancella il timer di pausa attuale
    pauseTimer = setTimeout(clearTomato, 30 * 60 * 1000);
}

function clearTomato() {

    if (!live) return;

    var minutes, seconds;

    minutes = 0;
    seconds = 0;
    repetitionInput = 0;

    clearInterval(countdown);
    clearTimeout(pauseTimer);

    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;
    timerDisplay.textContent = minutes + ":" + seconds;
    document.getElementById("circle2").style.height = 0 + "%";

    startStudy(0, 0);
}

function totStudyTime() {
    var totStudied = (cicli * studyInput * 60) + (studyInput * 60 - sTimeLeft * 60);
    return totStudied;
}

function timePercent() {
    if (ogRepInput === 0) {
        return 0; // Non c'è tempo di studio pianificato
    }

    var totStudied = totStudyTime();
    var totalTime = studyInput * 60 * ogRepInput;

    if (totalTime === 0) {
        return 100; // Evitare divisione per zero
    }

    var percentual = (totStudied / totalTime) * 100;

    return percentual.toFixed(2);
}

window.addEventListener('beforeunload', function() {
    localStorage.setItem('timerState', JSON.stringify({
        isRunning: isRunning,
        studying: studying,
        timeLeft: timeLeft,
        sTimeLeft: sTimeLeft,
        studyInput: studyInput,
        pauseInput: pauseInput,
        repetitionInput: repetitionInput,
        ogRepInput: ogRepInput,
        cicli: cicli,
        firstTime: firstTime,
        current: current,
        timerId: timerId,
        countdown: countdown,
        pauseTimer: pauseTimer,
        live: live
    }));
});

window.addEventListener('load', function() {
    var timerState = localStorage.getItem('timerState');
    if (timerState) {
        timerState = JSON.parse(timerState);
        isRunning = timerState.isRunning;
        studying = timerState.studying;
        timeLeft = timerState.timeLeft;
        sTimeLeft = timerState.sTimeLeft;
        studyInput = timerState.studyInput;
        pauseInput = timerState.pauseInput;
        repetitionInput = timerState.repetitionInput;
        ogRepInput = timerState.ogRepInput;
        cicli = timerState.cicli;
        firstTime = timerState.firstTime;
        current = timerState.current;
        timerId = timerState.timerId;
        countdown = timerState.countdown;
        pauseTimer = timerState.pauseTimer;
        live = timerState.live;

        document.getElementById("studyTime").value = studyInput;
        document.getElementById("pauseTime").value = pauseInput;
        document.getElementById("repTime").value = ogRepInput;

        var sButton = document.getElementById("startButton");
        current = document.getElementById("current");

        if (isRunning) {
            if (studying) {
                sButton.textContent = "PAUSE";
                current.textContent = "STUDYING...";
                startStudy(timeLeft, pauseInput);
            } else {
                sButton.textContent = "RESUME";
                current.textContent = "BREAK!";
                startPause(timeLeft, studyInput);
            }
        }
    }
});