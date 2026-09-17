/*
=========================================================
CARDTRACK BACKEND
=========================================================
Backend per l'app CardTrack.
Funzioni:
GET  /api/health
GET  /api/search
GET  /api/price
GET  /api/cards
Il server legge il Price Guide di Cardmarket dal file:
data/price-guide.csv
IMPORTANTE:
Cardmarket aggiorna il Price Guide una volta al giorno.
Questo backend NON utilizza la vecchia API Cardmarket.
=========================================================
*/
const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const cors = require("cors");
/* =====================================================
   CONFIGURAZIONE
===================================================== */
const PORT = process.env.PORT || 3000;
const DATA_FOLDER =
    path.join(__dirname, "data");
const PRICE_GUIDE_FILE =
    path.join(DATA_FOLDER, "price-guide.csv");
/* =====================================================
   APP
===================================================== */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
/* =====================================================
   DATABASE IN MEMORIA
===================================================== */
let products = [];
let lastLoad = null;
/* =====================================================
   NORMALIZZAZIONE TESTO
===================================================== */
function normalizeText(text) {
    if (!text) return "";
    return String(text)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}
/* =====================================================
   CONVERSIONE NUMERO
===================================================== */
function number(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }
    let text =
        String(value)
        .replace("€", "")
        .replace(/\s/g, "")
        .replace(",", ".");
    const result =
        parseFloat(text);
    return Number.isNaN(result)
        ? null
        : result;
}
/* =====================================================
   CARICAMENTO CSV
===================================================== */
function loadPriceGuide() {
    return new Promise((resolve, reject) => {
        products = [];
        if (!fs.existsSync(PRICE_GUIDE_FILE)) {
            return reject(
                new Error(
                    "File Price Guide non trovato: " +
                    PRICE_GUIDE_FILE
                )
            );
        }
        fs.createReadStream(
            PRICE_GUIDE_FILE
        )
        .pipe(
            csv({
                separator: ","
            })
        )
        .on("data", row => {
            /*
            Cardmarket può cambiare leggermente
            le intestazioni del CSV.
            Per questo cerchiamo diverse
            possibili varianti.
            */
            const name =
                row.Name ||
                row.name ||
                row["Product Name"] ||
                row["ProductName"] ||
                "";
            const id =
                row.idProduct ||
                row["Product ID"] ||
                row.id ||
                "";
            const expansion =
                row.Expansion ||
                row.expansion ||
                row["Expansion Name"] ||
                "";
            const language =
                row.Language ||
                row.language ||
                "";
            const condition =
                row.Condition ||
                row.condition ||
                "";
            const price =
                row.Price ||
                row.price ||
                row["Price Guide"] ||
                row["Trend Price"] ||
                "";
            products.push({
                id,
                name,
                normalizedName:
                    normalizeText(name),
                expansion,
                normalizedExpansion:
                    normalizeText(expansion),
                language,
                normalizedLanguage:
                    normalizeText(language),
                condition,
                normalizedCondition:
                    normalizeText(condition),
                price:
                    number(price),
                raw: row
            });
        })
        .on("end", () => {
            lastLoad =
                new Date();
            console.log(
                `Price Guide caricato: ${products.length} prodotti`
            );
            resolve();
        })
        .on("error", reject);
    });
}
/* =====================================================
   RICERCA PRODOTTI
===================================================== */
function searchProducts({
    name,
    expansion,
    language,
    condition
}) {
    const normalizedName =
        normalizeText(name);
    const normalizedExpansion =
        normalizeText(expansion);
    const normalizedLanguage =
        normalizeText(language);
    const normalizedCondition =
        normalizeText(condition);
    let results =
        products;
    /*
    -----------------------------------------------
    NOME
    -----------------------------------------------
    */
    if (normalizedName) {
        results =
            results.filter(product =>
                product.normalizedName
                    .includes(normalizedName)
            );
    }
    /*
    -----------------------------------------------
    ESPANSIONE
    -----------------------------------------------
    */
    if (normalizedExpansion) {
        results =
            results.filter(product =>
                product.normalizedExpansion
                    .includes(normalizedExpansion)
            );
    }
    /*
    -----------------------------------------------
    LINGUA
    -----------------------------------------------
    */
    if (normalizedLanguage) {
        results =
            results.filter(product =>
                product.normalizedLanguage
                    .includes(normalizedLanguage)
            );
    }
    /*
    -----------------------------------------------
    CONDIZIONE
    -----------------------------------------------
    */
    if (normalizedCondition) {
        results =
            results.filter(product =>
                product.normalizedCondition
                    .includes(normalizedCondition)
            );
    }
    return results;
}
/* =====================================================
   HOME API
===================================================== */
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        status: "online",
        products:
            products.length,
        lastLoad
    });
});
/* =====================================================
   SEARCH API
=====================================================
   Esempio:
   /api/search?name=Charizard
===================================================== */
app.get("/api/search", (req, res) => {
    try {
        const results =
            searchProducts({
                name:
                    req.query.name || "",
                expansion:
                    req.query.expansion || "",
                language:
                    req.query.language || "",
                condition:
                    req.query.condition || ""
            });
        res.json({
            success: true,
            count:
                results.length,
            results:
                results.slice(0, 50)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error:
                "Errore durante la ricerca."
        });
    }
});
/* =====================================================
   PRICE API
=====================================================
Esempio:
/api/price?
name=Charizard ex&
expansion=Paldean Fates&
language=Italian&
condition=NM
===================================================== */
app.get("/api/price", (req, res) => {
    try {
        const results =
            searchProducts({
                name:
                    req.query.name || "",
                expansion:
                    req.query.expansion || "",
                language:
                    req.query.language || "",
                condition:
                    req.query.condition || ""
            });
        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                error:
                    "Carta non trovata nel Price Guide.",
                query: req.query
            });
        }
        /*
        Prendiamo il primo risultato.
        In una versione successiva possiamo
        aggiungere un sistema di matching
        molto più preciso.
        */
        const product =
            results[0];
        res.json({
            success: true,
            card: {
                id:
                    product.id,
                name:
                    product.name,
                expansion:
                    product.expansion,
                language:
                    product.language,
                condition:
                    product.condition,
                price:
                    product.price
            },
            source:
                "Cardmarket Price Guide",
            updated:
                lastLoad
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error:
                "Errore durante il recupero del prezzo."
        });
    }
});
/* =====================================================
   CARDS API
===================================================== */
app.get("/api/cards", (req, res) => {
    res.json({
        success: true,
        count:
            products.length,
        cards:
            products.slice(0, 100)
    });
});
/* =====================================================
   AVVIO
===================================================== */
async function startServer() {
    try {
        await loadPriceGuide();
    } catch (error) {
        console.warn("");
        console.warn(
            "ATTENZIONE:"
        );
        console.warn(
            error.message
        );
        console.warn(
            "Il server partirà comunque."
        );
        console.warn(
            "Inserisci il Price Guide nella cartella /data."
        );
        console.warn("");
    }
    app.listen(
        PORT,
        () => {
            console.log("");
            console.log(
                "===================================="
            );
            console.log(
                "       CARDTRACK SERVER"
            );
            console.log(
                "===================================="
            );
            console.log(
                `Server: http://localhost:${PORT}`
            );
            console.log(
                `Prodotti: ${products.length}`
            );
            console.log(
                "===================================="
            );
            console.log("");
        }
    );
}
startServer();
