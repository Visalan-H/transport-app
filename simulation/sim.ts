const BUS_NAME = 'CHETPET';
let lat = 13.0827;
let lng = 80.2707;

const simulateMovement = async () => {
    lat += (Math.random() - 0.5) * 0.002;
    lng += (Math.random() - 0.5) * 0.002;

    try {
        await fetch('http://localhost:3000/update', {
            method: 'POST',
            body: JSON.stringify({ name: BUS_NAME, lat, lng }),
        });
    } catch (e) {
        console.error('Failed to update location:', e);
    }
    console.log(`Updated location: (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
};

setInterval(simulateMovement, 2000);
