const express = require("express");
const pool = require("../db");

const router = express.Router();

const isValidNumber = (value) => Number.isInteger(Number(value));

router.post("/add-driver", async (req, res) => {
  try {
    const { name, x, y } = req.body;

    if (!name || !isValidNumber(x) || !isValidNumber(y)) {
      return res.status(400).json({
        error: "Invalid input. name, x, and y are required."
      });
    }

    const [result] = await pool.execute(
      "INSERT INTO drivers (name, x, y, is_available) VALUES (?, ?, ?, true)",
      [name, Number(x), Number(y)]
    );

    const [rows] = await pool.execute("SELECT * FROM drivers WHERE id = ?", [
      result.insertId
    ]);

    return res.status(201).json(rows[0]);
  } catch (error) {
    return res.status(500).json({ error: "Failed to add driver." });
  }
});

router.post("/request-ride", async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const { userName, pickupX, pickupY } = req.body;

    if (!userName || !isValidNumber(pickupX) || !isValidNumber(pickupY)) {
      return res.status(400).json({
        error: "Invalid input. userName, pickupX, and pickupY are required."
      });
    }

    await connection.beginTransaction();

    const [availableDrivers] = await connection.execute(
      `SELECT id, name, x, y, is_available, ABS(x - ?) + ABS(y - ?) AS distance
       FROM drivers
       WHERE is_available = true
       ORDER BY distance, id
       LIMIT 1 FOR UPDATE`,
      [Number(pickupX), Number(pickupY)]
    );

    if (availableDrivers.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "No drivers available." });
    }

    const assignedDriver = availableDrivers[0];

    await connection.execute(
      "UPDATE drivers SET is_available = false WHERE id = ?",
      [assignedDriver.id]
    );

    const [rideResult] = await connection.execute(
      `INSERT INTO rides (user_name, pickup_x, pickup_y, assigned_driver_id)
       VALUES (?, ?, ?, ?)`,
      [
        userName,
        Number(pickupX),
        Number(pickupY),
        assignedDriver.id
      ]
    );

    await connection.commit();

    return res.status(201).json({
      message: "Ride assigned successfully.",
      rideId: rideResult.insertId,
      assignedDriver
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    return res.status(500).json({ error: "Failed to request ride." });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.get("/drivers", async (_req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM drivers ORDER BY id");
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch drivers." });
  }
});

router.get("/rides", async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.id, r.user_name, r.pickup_x, r.pickup_y, r.assigned_driver_id, d.name AS driver_name
       FROM rides r
       LEFT JOIN drivers d ON r.assigned_driver_id = d.id
       ORDER BY r.id`
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch rides." });
  }
});

router.post("/complete-ride", async (req, res) => {
  try {
    const { driverId } = req.body;

    if (!isValidNumber(driverId)) {
      return res.status(400).json({ error: "Invalid input. driverId is required." });
    }

    const [result] = await pool.execute(
      "UPDATE drivers SET is_available = true WHERE id = ?",
      [Number(driverId)]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Driver not found." });
    }

    return res.json({ message: "Ride completed. Driver marked as available." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to complete ride." });
  }
});

module.exports = router;
