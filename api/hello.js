export default function handler(req, res) {
  return res.status(200).json({
    message: "API funziona!",
    timestamp: new Date().toISOString(),
    method: req.method
  });
}
