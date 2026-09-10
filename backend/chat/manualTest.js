// Run from the backend/ directory with: node src/chat/manualTest.js
const { app, seed } = require("../server");

async function main() {
    seed();
    const server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    const port = server.address().port;
    const base = `http://localhost:${port}`;

    const questions = [
        "What is our biggest emission source?",
        "What costs us the most?",
        "Which scope has the highest emissions?",
        "Which recommendation has the shortest payback?",
        "What are our quick wins?",
        "What if we reduce diesel by 20%?",
        "How much could we save?",
        "What should we prioritize?",
        "What is the meaning of life?", // unrecognized
    ];

    for (const message of questions) {
        const res = await fetch(`${base}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId: 1, message }),
        });
        const data = await res.json();
        console.log("Q:", message);
        console.log("->", JSON.stringify(data, null, 2));
        console.log("---");
    }

    server.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
