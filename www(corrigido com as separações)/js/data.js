/* data.js — variáveis globais e persistência */
let gasData = [];
let users = [];
let currentUser = null;
let pendingPrices = {};
let certifications = {};
let priceHistory = {};

let previousScreenId = null;
let currentScreenId = null;
let selectingLocationForPosto = false;
let tempMarker = null;

let selectingWaypoints = false;
let tempWaypoints = [];
let tempWayMarkers = [];
let routeFoundStations = [];
let currentSortMode = 'price';

let driverMode = false;
let driverStations = [];
let voiceAlertCooldown = {};
let speechSynthesis = window.speechSynthesis;

function loadData() {
    try { gasData = JSON.parse(localStorage.getItem('stations') || '[]'); } catch(e) { gasData = []; }
    try { users = JSON.parse(localStorage.getItem('users') || '[]'); } catch(e) { users = []; }
    try { currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch(e) { currentUser = null; }
    try { pendingPrices = JSON.parse(localStorage.getItem('pendingPrices') || '{}'); } catch(e) { pendingPrices = {}; }
    try { certifications = JSON.parse(localStorage.getItem('certifications') || '{}'); } catch(e) { certifications = {}; }
    try { priceHistory = JSON.parse(localStorage.getItem('priceHistory') || '{}'); } catch(e) { priceHistory = {}; }

    console.log('📊 Dados carregados:', {
        stations: gasData.length,
        users: users.length,
        currentUser: !!currentUser
    });
}

function saveData() {
    localStorage.setItem('stations', JSON.stringify(gasData));
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('pendingPrices', JSON.stringify(pendingPrices));
    localStorage.setItem('certifications', JSON.stringify(certifications));
    localStorage.setItem('priceHistory', JSON.stringify(priceHistory));
}

function addSampleStations() {
    if (gasData.length === 0) {
        const sampleStations = [
            {
                id: 'sample_1',
                name: 'Posto Shell',
                coords: [-7.076944, -41.466944],
                prices: { gas: 5.89, etanol: 4.20, diesel: 4.95 },
                isVerified: true,
                trustScore: 8.5
            },
            {
                id: 'sample_2',
                name: 'Posto Ipiranga',
                coords: [-7.080, -41.470],
                prices: { gas: 5.75, etanol: 4.15, diesel: 4.85 },
                isVerified: false,
                trustScore: 7.2
            }
        ];
        gasData.push(...sampleStations);
        saveData();
    }
}
