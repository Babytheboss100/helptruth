// middleware/auth.js
// Dette sjekker at brukeren er logget inn på hver beskyttet rute
// JWT = JSON Web Token: en kryptert "billett" som beviser hvem du er

const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  // Hent token fra header: "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Ikke autorisert - logg inn først" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verifiser token med hemmelig nøkkel
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "hemmelig-nøkkel");
    req.user = decoded;  // Legg brukerinfo på request-objektet
    next();              // Gå videre til neste funksjon
  } catch (err) {
    return res.status(401).json({ error: "Ugyldig eller utløpt token" });
  }
}

module.exports = authMiddleware;
