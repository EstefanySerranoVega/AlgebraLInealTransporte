class TransportOptimizer {
    constructor(data = null) {
        // Datos por defecto para Línea 74 y 75
        this.defaultLines = {
            74: {
                stopsNames: [
                    "Av. Virgen de Cotoca 3er anillo interno",
                    "Av. Virgen de Cotoca _ Hospital Japones",
                    "Hospital Japones _ Mercado Mutualista",
                    "Mercado Mutualista _ Av. Banzer",
                    "Av. Banzer _ Utepsa",
                    "Utepsa _ Mercado Abasto antiguo",
                    "Mercado Abasto _ Av. Grigota",
                    "Av. Grigota _ Av. Santos Dumont"
                ],
                tiemposEntre: [0, 5, 6, 8, 6, 18, 2, 9],
                tiemposAcum: [0, 5, 11, 19, 25, 43, 45, 54],
                distancias: [0, 1.1, 2.7, 4.8, 7.6, 12.1, 13.3, 15.9],
                pasajeros: [15, 13, 14, 20, 13, 18, 21, 16],
                costosTramo: [0, 1.65, 2.39, 3.14, 4.19, 6.73, 1.80, 3.89]
            },
            75: {
                stopsNames: [
                    "Av. Virgen de Cotoca 3er anillo externo",
                    "Av. Virgen de Cotoca _ Hospital Japones",
                    "Hospital Japones _ Mercado Mutualista",
                    "Mercado Mutualista _ Av. Banzer",
                    "Av. Banzer _ UPDS",
                    "UPDS _ Mercado Abasto antiguo",
                    "Mercado Abasto _ Av. Grigota",
                    "Av. Grigota _ Av. Santos Dumont"
                ],
                tiemposEntre: [0, 10, 6, 12, 7, 22, 4, 9],
                tiemposAcum: [0, 10, 16, 28, 35, 57, 61, 70],
                distancias: [0, 1.2, 2.7, 5.6, 7.7, 14.9, 17.7, 23.4],
                pasajeros: [2, 8, 17, 22, 20, 27, 32, 37],
                costosTramo: [0, 1.80, 2.24, 4.34, 3.14, 10.77, 4.19, 8.53]
            }
        };
        this.lines = data || this.defaultLines;
        this.capacity = 38;
        this.fuelCost = 3.74;
        this.maintenanceCost = 20;
    }

    // Actualizar datos desde CSV
    updateFromCSV(csvData) {
        const lines = {
            74: { stopsNames: [], tiemposEntre: [], tiemposAcum: [], distancias: [], pasajeros: [], costosTramo: [] },
            75: { stopsNames: [], tiemposEntre: [], tiemposAcum: [], distancias: [], pasajeros: [], costosTramo: [] }
        };
        let lastDist74 = 0, acumPasajeros74 = 0;
        let lastDist75 = 0, acumPasajeros75 = 0;

        csvData.forEach(row => {
            const lineId = row.linea;
            if (!['74', '75'].includes(lineId)) return;

            lines[lineId].stopsNames.push(row.parada);
            lines[lineId].tiemposEntre.push(parseFloat(row.tiempo_entre_paradas_min) || 0);
            lines[lineId].distancias.push(parseFloat(row.distancia_km) || 0);

            const suben = parseInt(row.pasajeros_suben) || 0;
            const bajan = parseInt(row.pasajeros_bajan) || 0;
            if (lineId === '74') {
                acumPasajeros74 += suben - bajan;
                lines[74].pasajeros.push(Math.max(0, acumPasajeros74));
            } else {
                acumPasajeros75 += suben - bajan;
                lines[75].pasajeros.push(Math.max(0, acumPasajeros75));
            }

            const dist = parseFloat(row.distancia_km) - (lineId === '74' ? lastDist74 : lastDist75);
            lines[lineId].costosTramo.push(dist >= 0 ? dist * 0.4 * this.fuelCost : 0);
            if (lineId === '74') lastDist74 = parseFloat(row.distancia_km);
            else lastDist75 = parseFloat(row.distancia_km);
        });

        // Calcular tiempos acumulados
        lines[74].tiemposAcum = lines[74].tiemposEntre.reduce((acc, t, i) => {
            acc.push(i === 0 ? 0 : acc[i - 1] + t);
            return acc;
        }, []);
        lines[75].tiemposAcum = lines[75].tiemposEntre.reduce((acc, t, i) => {
            acc.push(i === 0 ? 0 : acc[i - 1] + t);
            return acc;
        }, []);

        // Validar datos
        if (lines[74].stopsNames.length !== 8 || lines[75].stopsNames.length !== 8) {
            throw new Error("El CSV debe contener exactamente 8 paradas por línea (74 y 75).");
        }
        if (lines[74].pasajeros.some(p => p > this.capacity) || lines[75].pasajeros.some(p => p > this.capacity)) {
            throw new Error("La demanda de pasajeros excede la capacidad del micro (35).");
        }

        this.lines = lines;
    }

    // Generar matriz de tiempos (8x8)
    generateTimeMatrix(lineId) {
        const tiempos = this.lines[lineId].tiemposAcum;
        const matrix = Array(8).fill().map(() => Array(8).fill(0));
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                matrix[i][j] = Math.abs(tiempos[j] - tiempos[i]);
            }
        }
        return matrix;
    }

    // Generar vector de pasajeros (8x1)
    generatePassengerVector(lineId) {
        return this.lines[lineId].pasajeros;
    }

    // Generar matriz de costos (8x1)
    generateCostVector(lineId) {
        return this.lines[lineId].costosTramo;
    }

    calculateWeightedTime(lineId) {
        const timeMatrix = this.generateTimeMatrix(lineId);
        const passengerVector = this.generatePassengerVector(lineId);
        return timeMatrix.map(row => row.reduce((sum, val, j) => sum + val * passengerVector[j], 0));
    }

    calculateAPrime(lineId) {
        const timeMatrix = this.generateTimeMatrix(lineId);
        const costVector = this.generateCostVector(lineId);
        return timeMatrix.map(row => row.reduce((sum, val, j) => sum + val * costVector[j], 0));
    }

    calculateFinalResult(lineId) {
        const aPrime = this.calculateAPrime(lineId);
        const passengerVector = this.generatePassengerVector(lineId);
        return aPrime.reduce((sum, val, i) => sum + val * passengerVector[i], 0);
    }
    optimizeFrequencies() {
        const costo74 = (this.lines[74].distancias[7] * 0.4 * this.fuelCost + (this.lines[74].tiemposAcum[7] / 60) * this.maintenanceCost);
        const costo75 = (this.lines[75].distancias[7] * 0.4 * this.fuelCost + (this.lines[75].tiemposAcum[7] / 60) * this.maintenanceCost);
        const minFrequency = 8; // 7.5 min
        const maxPasajeros74 = Math.max(...this.lines[74].pasajeros) * 2; // Ajuste por pico
        const maxPasajeros75 = Math.max(...this.lines[75].pasajeros) * 2; // Ajuste por pico
        const A = [[1, 0], [0, 1]];
        const b = [Math.max(minFrequency, maxPasajeros74 / this.capacity), Math.max(minFrequency, maxPasajeros75 / this.capacity)];
        const ingresos74 = (maxPasajeros74 * 0.7 * 1 + maxPasajeros74 * 0.3 * 2.5); 
        const ingresos75 = (maxPasajeros75 * 0.7 * 1 + maxPasajeros75 * 0.3 * 2.5);
        return {
            f74: b[0],
            f75: b[1],
            costoTotal: costo74 * b[0] + costo75 * b[1],
            costoActual: costo74 * 4 + costo75 * 4,
            ingresosTotales: ingresos74 + ingresos75,
            beneficio: (ingresos74 + ingresos75) - (costo74 * b[0] + costo75 * b[1])
        };
    }

    generateCoords(lineId) {
        const distancias = this.lines[lineId].distancias;
        return distancias.map((dist, i) => ({ x: dist, y: lineId === '74' ? 0 : 1 }));
    }

    optimizeRoutes() {
        const results = {
            74: {
                timeMatrix: this.generateTimeMatrix(74),
                passengerVector: this.generatePassengerVector(74),
                costVector: this.generateCostVector(74),
                weightedTime: this.calculateWeightedTime(74),
                aPrime: this.calculateAPrime(74),
                finalResult: this.calculateFinalResult(74),
                coords: this.generateCoords(74),
                route: Array.from({ length: 8 }, (_, i) => i),
                stopsNames: this.lines[74].stopsNames,
                tiemposAcum: this.lines[74].tiemposAcum,
                distancias: this.lines[74].distancias,
                tiemposEntre: this.lines[74].tiemposEntre
            },
            75: {
                timeMatrix: this.generateTimeMatrix(75),
                passengerVector: this.generatePassengerVector(75),
                costVector: this.generateCostVector(75),
                weightedTime: this.calculateWeightedTime(75),
                aPrime: this.calculateAPrime(75),
                finalResult: this.calculateFinalResult(75),
                coords: this.generateCoords(75),
                route: Array.from({ length: 8 }, (_, i) => i),
                stopsNames: this.lines[75].stopsNames,
                tiemposAcum: this.lines[75].tiemposAcum,
                distancias: this.lines[75].distancias,
                tiemposEntre: this.lines[75].tiemposEntre
            },
            frequencies: this.optimizeFrequencies(),
            intersections: [
                { name: "Hospital Japones", stops: ["74-2", "75-2"] },
                { name: "Mercado Abasto", stops: ["74-6", "75-6"] },
                { name: "Av. Santos Dumont", stops: ["74-8", "75-8"] }
            ]
        };
        window.currentData = results;
        return results;
    }
}

async function generateOptimization() {
    try {
        document.getElementById('loading').style.display = 'block';
        await new Promise(resolve => setTimeout(resolve, 1000));

        const optimizer = new TransportOptimizer(window.customData || null);
        const results = optimizer.optimizeRoutes();

        const requiredIds = [
            'timeMatrix74', 'timeMatrix75', 'passengerVector74', 'passengerVector75',
            'weightedTime74', 'weightedTime75', 'aPrime74', 'aPrime75',
            'costVector74', 'costVector75', 'tiemposEntre74', 'tiemposEntre75',
            'frequenciesBar', 'routeVisualization', 'optimizationResults'
        ];
        for (const id of requiredIds) {
            if (!document.getElementById(id)) {
                throw new Error(`El contenedor con ID ${id} no existe en el HTML.`);
            }
        }

        createTimeMatrix(results[74].timeMatrix, results[74].stopsNames, 74);
        createTimeMatrix(results[75].timeMatrix, results[75].stopsNames, 75);
        createPassengerVector(results[74].passengerVector, results[74].stopsNames, 74);
        createPassengerVector(results[75].passengerVector, results[75].stopsNames, 75);
        createWeightedTimeVisualization(results[74].weightedTime, results[74].stopsNames, 74);
        createWeightedTimeVisualization(results[75].weightedTime, results[75].stopsNames, 75);
        createAPrimeVisualization(results[74].aPrime, results[74].stopsNames, 74);
        createAPrimeVisualization(results[75].aPrime, results[75].stopsNames, 75);
        createCostVectorVisualization(results[74].costVector, results[74].stopsNames, 74);
        createCostVectorVisualization(results[75].costVector, results[75].stopsNames, 75);
        createTiemposEntreVisualization(results[74].tiemposEntre, results[74].stopsNames, 74);
        createTiemposEntreVisualization(results[75].tiemposEntre, results[75].stopsNames, 75);
        createFrequenciesBar(results.frequencies);
        createRouteVisualization(results);
        displayOptimizationResults(results);

        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error("Error en generateOptimization:", error);
        alert("Error al generar la optimización: " + error.message);
        document.getElementById('loading').style.display = 'none';
    }
}

function loadCSVData(event) {
    const file = event.target.files[0];
    if (!file) {
        alert("Por favor, selecciona un archivo CSV.");
        return;
    }

    Papa.parse(file, {
        header: true,
        complete: function (results) {
            try {
                const requiredColumns = ['linea', 'nro_parada', 'parada', 'distancia_km', 'tiempo_entre_paradas_min', 'pasajeros_suben', 'pasajeros_bajan'];
                const data = results.data.filter(row => requiredColumns.every(col => row[col] !== undefined));
                if (data.length < 16) throw new Error("El CSV debe contener datos para 8 paradas por línea (74 y 75).");

                const optimizer = new TransportOptimizer();
                optimizer.updateFromCSV(data);
                window.customData = optimizer.lines;
                generateOptimization();
            } catch (error) {
                console.error("Error al cargar CSV:", error);
                alert("Error al procesar el CSV: " + error.message);
            }
        },
        error: function (error) {
            console.error("Error al parsear CSV:", error);
            alert("Error al leer el archivo CSV: " + error.message);
        }
    });
}

function createTimeMatrix(matrix, stops, lineId) {
    const trace = {
        z: matrix,
        x: stops.map((_, i) => `P${i + 1}`),
        y: stops.map((_, i) => `P${i + 1}`),
        type: 'heatmap',
        colorscale: 'Viridis',
        showscale: true,
        text: matrix.map(row => row.map(val => val.toFixed(1))),
        texttemplate: "%{text}",
        textfont: { size: 10, color: "white" },
        hovertemplate: '<b>%{y} → %{x}</b><br>Tiempo: %{z} min<extra></extra>'
    };

    const layout = {
        title: { text: `Matriz de Tiempos Línea ${lineId} (min)`, font: { size: 16 } },
        xaxis: { title: 'Destino', tickangle: -45 },
        yaxis: { title: 'Origen' },
        margin: { l: 80, r: 80, t: 80, b: 80 },
        font: { size: 12 }
    };

    Plotly.newPlot(`timeMatrix${lineId}`, [trace], layout, { responsive: true, displayModeBar: false });
}

function createPassengerVector(vector, stops, lineId) {
    const trace = {
        x: stops.map((_, i) => `P${i + 1}`),
        y: vector,
        type: 'bar',
        marker: { color: '#667eea' },
        hovertemplate: '<b>%{x}</b><br>Pasajeros: %{y}<extra></extra>'
    };

    const layout = {
        title: { text: `Pasajeros Acumulados Línea ${lineId} (pax/h)`, font: { size: 16 } },
        xaxis: { title: 'Parada', tickangle: -45 },
        yaxis: { title: 'Pasajeros por Hora' },
        margin: { l: 60, r: 30, t: 60, b: 80 },
        font: { size: 12 }
    };

    Plotly.newPlot(`passengerVector${lineId}`, [trace], layout, { responsive: true, displayModeBar: false });
}

function createWeightedTimeVisualization(vector, stops, lineId) {
    const trace = {
        x: stops.map((_, i) => `P${i + 1}`),
        y: vector,
        type: 'line',
        mode: 'lines+markers',
        line: { color: '#667eea', width: 2 },
        marker: { size: 8, color: '#764ba2' },
        hovertemplate: '<b>%{x}</b><br>Tiempo Ponderado: %{y:.0f} min-pax/h<extra></extra>'
    };

    const layout = {
        title: { text: `Tiempo Ponderado Línea ${lineId}`, font: { size: 16 } },
        xaxis: { title: 'Origen', tickangle: -45 },
        yaxis: { title: 'Tiempo Ponderado (min-pax/h)' },
        margin: { l: 60, r: 30, t: 60, b: 80 }
    };

    Plotly.newPlot(`weightedTime${lineId}`, [trace], layout, { responsive: true, displayModeBar: false });
}

// Visualización para A'
function createAPrimeVisualization(vector, stops, lineId) {
    const trace = {
        x: stops.map((_, i) => `P${i + 1}`),
        y: vector,
        type: 'bar',
        marker: { color: '#45B7D1' },
        hovertemplate: '<b>%{x}</b><br>A\' (min-Bs): %{y:.2f}<extra></extra>'
    };

    const layout = {
        title: { text: `Matriz A' Línea ${lineId} (Tiempo Afectado por Costos)`, font: { size: 16 } },
        xaxis: { title: 'Parada', tickangle: -45 },
        yaxis: { title: 'Valor (min-Bs)' },
        margin: { l: 60, r: 30, t: 60, b: 80 }
    };

    Plotly.newPlot(`aPrime${lineId}`, [trace], layout, { responsive: true, displayModeBar: false });
}

// Visualización para costos por tramo
function createCostVectorVisualization(vector, stops, lineId) {
    const trace = {
        x: stops.map((_, i) => `P${i + 1}`),
        y: vector,
        type: 'bar',
        marker: { color: '#FFA07A' },
        hovertemplate: '<b>%{x}</b><br>Costo: %{y:.2f} Bs<extra></extra>'
    };

    const layout = {
        title: { text: `Costos por Tramo Línea ${lineId} (Bs)`, font: { size: 16 } },
        xaxis: { title: 'Parada', tickangle: -45 },
        yaxis: { title: 'Costo (Bs)' },
        margin: { l: 60, r: 30, t: 60, b: 80 }
    };

    Plotly.newPlot(`costVector${lineId}`, [trace], layout, { responsive: true, displayModeBar: false });
}

// Visualización para tiempos entre paradas
function createTiemposEntreVisualization(vector, stops, lineId) {
    const trace = {
        x: stops.map((_, i) => `P${i + 1}`),
        y: vector,
        type: 'bar',
        marker: { color: '#98D8C8' },
        hovertemplate: '<b>%{x}</b><br>Tiempo Entre Paradas: %{y:.0f} min<extra></extra>'
    };

    const layout = {
        title: { text: `Tiempos Entre Paradas Línea ${lineId} (min)`, font: { size: 16 } },
        xaxis: { title: 'Parada', tickangle: -45 },
        yaxis: { title: 'Tiempo (min)' },
        margin: { l: 60, r: 30, t: 60, b: 80 }
    };

    Plotly.newPlot(`tiemposEntre${lineId}`, [trace], layout, { responsive: true, displayModeBar: false });
}

function createFrequenciesBar(frequencies) {
    const trace = {
        x: ['Línea 74', 'Línea 75'],
        y: [frequencies.f74, frequencies.f75],
        type: 'bar',
        marker: { color: ['#FF6B6B', '#4ECDC4'] },
        hovertemplate: '<b>%{x}</b><br>Frecuencia: %{y:.2f} micros/h (~%{value|60/value:.0f} min)<extra></extra>'
    };
    const layout = {
        title: { text: 'Frecuencias Óptimas', font: { size: 16 } },
        xaxis: { title: 'Línea' },
        yaxis: { title: 'Micros por Hora' },
        margin: { l: 60, r: 30, t: 60, b: 50 }
    };
    Plotly.newPlot('frequenciesBar', [trace], layout, { responsive: true, displayModeBar: false });
}

// Visualización de rutas
function createRouteVisualization(results) {
    const traces = [];
    const colors = ['#FF6B6B', '#4ECDC4'];

    Object.keys(results).filter(key => ['74', '75'].includes(key)).forEach((lineId, idx) => {
        const { coords, route, stopsNames } = results[lineId];
        traces.push({
            x: coords.map(c => c.x),
            y: coords.map(c => c.y),
            mode: 'lines+markers+text',
            type: 'scatter',
            text: stopsNames.map((_, i) => `P${i + 1}`),
            textposition: 'top center',
            line: { color: colors[idx], width: 4 },
            marker: { size: 10, color: colors[idx], symbol: 'circle' },
            name: `Línea ${lineId}`,
            hovertemplate: '<b>%{text}</b><br>Distancia: %{x:.1f} km<extra></extra>'
        });
    });

    const layout = {
        title: { text: 'Rutas de Líneas 74 y 75', font: { size: 16 } },
        xaxis: { title: 'Distancia Acumulada (km)' },
        yaxis: { title: 'Línea', range: [-0.5, 1.5], tickvals: [0, 1], ticktext: ['Línea 74', 'Línea 75'] },
        showlegend: true,
        margin: { l: 60, r: 60, t: 60, b: 60 },
        hovermode: 'closest'
    };

    Plotly.newPlot('routeVisualization', traces, layout, { responsive: true, displayModeBar: false });
}

// Mostrar resultados de optimización
function displayOptimizationResults(results) {
    const { frequencies, intersections } = results;
    const output = `
        <h3>Resultados de Optimización</h3>
        <p><b>Frecuencia Óptima Línea 74:</b> ${frequencies.f74.toFixed(2)} micros/h (~${(60 / frequencies.f74).toFixed(0)} min)</p>
        <p><b>Frecuencia Óptima Línea 75:</b> ${frequencies.f75.toFixed(2)} micros/h (~${(60 / frequencies.f75).toFixed(0)} min)</p>
        <p><b>Costo Total Óptimo:</b> ${frequencies.costoTotal.toFixed(2)} Bs/h</p>
        <p><b>Costo Actual (5 micros/h):</b> ${frequencies.costoActual.toFixed(2)} Bs/h</p>
        <p><b>Reducción de Costo:</b> ${((1 - frequencies.costoTotal / frequencies.costoActual) * 100).toFixed(0)}%</p>
        <h4>Intersecciones:</h4>
        <ul>${intersections.map(i => `<li>${i.name}: ${i.stops.join(', ')}</li>`).join('')}</ul>
        <p><b>Recomendación:</b> Sincronizar llegadas en intersecciones con offset ~30 min para reducir trasbordos (~10-15% menos tiempo muerto).</p>
    `;
    document.getElementById('optimizationResults').innerHTML = output;
}

// Exportar resultados como CSV
function exportResults() {
    const results = window.currentData;
    if (!results) {
        alert("No hay resultados para exportar. Genera la optimización primero.");
        return;
    }

    const csvRows = [
        ["Línea", "Parada", "Nombre", "Tiempo Entre Paradas (min)", "Tiempo Acum (min)", "Distancia (km)", "Pasajeros (pax/h)"],
        ...Object.entries(results).filter(([key]) => ['74', '75'].includes(key)).flatMap(([lineId, data]) =>
            data.stopsNames.map((name, i) => [
                lineId,
                i + 1,
                name,
                data.tiemposEntre[i],
                data.tiemposAcum[i],
                data.distancias[i],
                data.passengerVector[i]
            ])
        ),
        [],
        ["Frecuencias Óptimas"],
        ["Línea 74", `${results.frequencies.f74.toFixed(2)} micros/h (~${(60 / results.frequencies.f74).toFixed(0)} min)`],
        ["Línea 75", `${results.frequencies.f75.toFixed(2)} micros/h (~${(60 / results.frequencies.f75).toFixed(0)} min)`],
        ["Costo Total", `${results.frequencies.costoTotal.toFixed(2)} Bs/h`],
        ["Costo Actual (5 micros/h)", `${results.frequencies.costoActual.toFixed(2)} Bs/h`],
        [],
        ["Intersecciones"],
        ...results.intersections.map(i => [i.name, i.stops.join(", ")])
    ];

    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'optimization_results.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// Inicializar al cargar la página
window.onload = generateOptimization;