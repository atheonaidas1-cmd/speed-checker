<?php
// collect.php – receives JSON payload and logs to a file (data.log) and optionally to MySQL
// For XAMPP, you can enable MySQL if you want; here we use a simple log file for simplicity.

header('Content-Type: application/json');

// Get raw POST data
$json = file_get_contents('php://input');
if (!$json) {
    echo json_encode(['status' => 'error', 'message' => 'No data']);
    exit;
}

$data = json_decode($json, true);
if (!$data) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

// Append to log file with timestamp
$logEntry = "[" . date('Y-m-d H:i:s') . "] " . json_encode($data) . PHP_EOL;
file_put_contents('data.log', $logEntry, FILE_APPEND);

// Optionally store in MySQL (if you want)
// Uncomment and configure if you have a database:
/*
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "fingerprint_db";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Create table if not exists
$sql = "CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    payload JSON
)";
$conn->query($sql);

$stmt = $conn->prepare("INSERT INTO logs (payload) VALUES (?)");
$stmt->bind_param("s", $json);
$stmt->execute();
$stmt->close();
$conn->close();
*/

// Return success
echo json_encode(['status' => 'success', 'message' => 'Data logged']);
?>