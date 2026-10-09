<?php
// Cozaint lead form handler.
// Receives the assessment/contact form (JSON) and emails it to the address below.
// Needs PHP with mail() enabled on the web server. No cost, no third-party service.

$TO   = 'info@cozaint.com';          // where leads are delivered
$FROM = 'no-reply@cozaint.com';      // must be an address on your own domain (helps avoid spam folders)

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function done($ok, $code = 200) { http_response_code($code); echo json_encode(array('ok' => $ok)); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { done(false, 405); }

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) { $data = $_POST; }

function clean($v, $max = 500) {
    $v = is_string($v) ? $v : '';
    $v = str_replace(array("\r", "\n", "\0"), ' ', $v);   // blocks email header injection
    $v = trim(strip_tags($v));
    return function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max);
}

// Spam trap: real visitors never see or fill this field.
if (!empty($data['website'])) { done(true); }

$name    = clean(isset($data['name']) ? $data['name'] : '', 120);
$email   = clean(isset($data['email']) ? $data['email'] : '', 200);
$phone   = clean(isset($data['phone']) ? $data['phone'] : '', 60);
$company = clean(isset($data['company']) ? $data['company'] : '', 200);
$improve = clean(isset($data['improve']) ? $data['improve'] : '', 200);
$source  = clean(isset($data['source']) ? $data['source'] : '', 200);
$calc    = clean(isset($data['calc']) ? $data['calc'] : '', 800);
$message = clean(isset($data['message']) ? $data['message'] : '', 2000);

if ($name === '' || $company === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) { done(false, 422); }

$subject = 'New Cozaint lead: ' . $company . ' (' . $name . ')';
$body  = "A new lead came in from the Cozaint website.\n\n";
$body .= "Name:    $name\nEmail:   $email\nPhone:   $phone\nCompany: $company\n";
$body .= "Goal:    $improve\nFrom:    $source\n";
if ($calc !== '')    { $body .= "\nCalculator numbers:\n$calc\n"; }
if ($message !== '') { $body .= "\nMessage:\n$message\n"; }
$body .= "\nSent: " . date('Y-m-d H:i:s T') . "\n";

$headers  = "From: Cozaint Website <$FROM>\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "Content-Type: text/plain; charset=utf-8\r\n";

$sent = @mail($TO, $subject, $body, $headers, '-f' . $FROM);
done($sent ? true : false, $sent ? 200 : 500);
