const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

const API_KEY = process.env.JUSTTCG_API_KEY;

if (!API_KEY) {
    console.error("ERRORE: manca JUSTTCG_API_KEY");
    process.exit(1);
}

app.use(express.json());
app.use(express.static(__dirname));

app.get("/api/card", async (req, res) => {
    try {
        const { name } = req.query;

        if (!name) {
            return res.status(400).json({
                error: "Inserisci il nome della carta"
            });
        }

        const url =
            "https://api.justtcg.com/v1/cards" +
            "?game=pokemon" +
            "&name=" +
            encodeURIComponent(name);

        const response = await fetch(url, {
            headers: {
                "x-api-key": API_KEY
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Errore nel collegamento a JustTCG"
        });
    }
});

app.listen(PORT, () => {
    console.log(`CardTrack avviato su http://localhost:${PORT}`);
});
