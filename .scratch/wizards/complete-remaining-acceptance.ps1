# Windows PowerShell 5.1:
# powershell.exe -ExecutionPolicy Bypass -File .\.scratch\wizards\complete-remaining-acceptance.ps1
# PowerShell 7:
# pwsh -File .\.scratch\wizards\complete-remaining-acceptance.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepositoryRoot = [System.IO.Path]::GetFullPath((Join-Path -Path $PSScriptRoot -ChildPath '..\..'))
$RunId = Get-Date -Format 'yyyyMMdd-HHmmss'
$ReportRelativePath = ".scratch/next-steps/evidence/$RunId-remaining-acceptance.md"
$ReportDirectory = Join-Path -Path $RepositoryRoot -ChildPath '.scratch\next-steps\evidence'
$ReportFile = Join-Path -Path $ReportDirectory -ChildPath "$RunId-remaining-acceptance.md"
$Report = [System.Text.StringBuilder]::new()
$Results = [System.Collections.Generic.List[object]]::new()
$TotalStages = 7
$StageNumber = 0
$Interactive = -not [System.Console]::IsInputRedirected -and -not [System.Console]::IsOutputRedirected

function Save-Report {
    $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($script:ReportFile, $script:Report.ToString(), $utf8WithoutBom)
}

function Clear-FocusedStage {
    if ($script:Interactive) {
        Clear-Host
    }
}

function Start-Stage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title
    )

    $script:StageNumber++
    if ($script:StageNumber -gt $script:TotalStages) {
        throw 'The wizard attempted to start more than seven stages.'
    }

    Clear-FocusedStage
    Write-Host ''
    Write-Host ("Stage {0}/{1}: {2}" -f $script:StageNumber, $script:TotalStages, $Title) -ForegroundColor Cyan
    Write-Host ''
}

function Add-StageHeading {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title
    )

    [void]$script:Report.AppendLine(("## Stage {0}/{1} - {2}" -f $script:StageNumber, $script:TotalStages, $Title))
    [void]$script:Report.AppendLine('')
}

function Write-Instruction {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    Write-Host ("  {0}" -f $Text)
}

function Write-Caution {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    Write-Host ("  CAUTION: {0}" -f $Text) -ForegroundColor Yellow
}

function Read-YesNo {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Prompt
    )

    $answer = Read-Host "$Prompt [y/N]"
    return $answer -match '^[Yy]$'
}

function Wait-ForUser {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Prompt
    )

    [void](Read-Host $Prompt)
}

function Get-UnsafeTextReason {
    param(
        [AllowNull()]
        [string]$Value,
        [int]$MaximumLength = 600
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    if ($Value -match '(?i)\bhttps?://') {
        return 'HTTP(S) URLs are not allowed.'
    }

    if ($Value -match '(?i)\[[^\]\r\n]+\]\([^)]+\)') {
        return 'Markdown link syntax is not allowed.'
    }

    if ($Value -match '(?i)(?:[A-Z]:[\\/]|\\\\|(?<!\w)\\[^\s]+)') {
        return 'Windows absolute paths and UNC paths are not allowed.'
    }

    if ($Value -match '(?i)(?<!\w)\.\.?[\\/]') {
        return 'Relative path prefixes are not allowed.'
    }

    if ($Value -match '(?i)(?:^|(?<!\w))/(?:[^\s]*)') {
        return 'Unix absolute paths are not allowed.'
    }

    if ($Value -match '(?i)\b(?:access[_-]?token|refresh[_-]?token|device[_-]?token|token|password|passwd|secret|api[_-]?key|client[_-]?secret|authorization)\b\s*[:=]') {
        return 'Credential assignment text is not allowed.'
    }

    if ($Value -match '(?i)\bBearer\s+[^\s]+') {
        return 'Bearer credential text is not allowed.'
    }

    if ($Value.Length -gt $MaximumLength) {
        return ("Use {0} characters or fewer." -f $MaximumLength)
    }

    return $null
}

function Normalize-ShortText {
    param(
        [AllowNull()]
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ''
    }

    return ([System.Text.RegularExpressions.Regex]::Replace($Value, '\s+', ' ')).Trim()
}

function ConvertTo-ReportValue {
    param(
        [AllowNull()]
        [string]$Value
    )

    $normalized = Normalize-ShortText $Value
    if ([string]::IsNullOrEmpty($normalized)) {
        return ''
    }

    $safe = $normalized.Replace('|', '\|').Replace('`', '')
    return $safe
}

function Read-SafeText {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Prompt,
        [int]$MaximumLength = 600,
        [switch]$AllowEmpty
    )

    while ($true) {
        $value = Read-Host $Prompt
        if (-not $AllowEmpty -and [string]::IsNullOrWhiteSpace($value)) {
            Write-Caution 'This value is required.'
            continue
        }

        $reason = Get-UnsafeTextReason -Value $value -MaximumLength $MaximumLength
        if ($null -eq $reason) {
            return (Normalize-ShortText $value)
        }

        Write-Caution $reason
        Write-Instruction 'Enter a short sanitized value, or leave it empty when allowed.'
    }
}

function Read-CommitSha {
    while ($true) {
        $value = (Read-Host 'Exact tested commit SHA (40 or 64 hexadecimal characters; empty is allowed)').Trim()
        if ([string]::IsNullOrWhiteSpace($value)) {
            return ''
        }

        if ($value -match '^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$') {
            return $value
        }

        Write-Caution 'Enter the exact 40- or 64-character hexadecimal commit SHA, or leave it empty.'
    }
}

function Get-WindowsPublicMetadata {
    $edition = ''
    $version = ''
    $build = ''

    try {
        $operatingSystem = Get-CimInstance -ClassName Win32_OperatingSystem -Property Caption, Version, BuildNumber | Select-Object -First 1
        if ($null -ne $operatingSystem) {
            $edition = [string]$operatingSystem.Caption
            $version = [string]$operatingSystem.Version
            $build = [string]$operatingSystem.BuildNumber
        }
    }
    catch {
        # Missing public OS metadata is handled by the prompts below.
    }

    if ([string]::IsNullOrWhiteSpace($edition)) {
        $edition = Read-SafeText -Prompt 'Windows edition (public; do not enter an account name; empty is allowed)' -MaximumLength 120 -AllowEmpty
    }
    if ([string]::IsNullOrWhiteSpace($version)) {
        $version = Read-SafeText -Prompt 'Windows version (public; empty is allowed)' -MaximumLength 80 -AllowEmpty
    }
    if ([string]::IsNullOrWhiteSpace($build)) {
        $build = Read-SafeText -Prompt 'Windows build (public; empty is allowed)' -MaximumLength 80 -AllowEmpty
    }

    return [pscustomobject]@{
        Edition = Normalize-ShortText $edition
        Version = Normalize-ShortText $version
        Build   = Normalize-ShortText $build
    }
}

function Add-CheckResult {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Ticket,
        [Parameter(Mandatory = $true)]
        [string]$Check,
        [Parameter(Mandatory = $true)]
        [ValidateSet('PASS', 'FAIL', 'SKIP')]
        [string]$Result,
        [AllowNull()]
        [string]$Notes,
        [AllowNull()]
        [string]$Evidence,
        [bool]$Optional = $false
    )

    $notesReason = Get-UnsafeTextReason -Value $Notes -MaximumLength 700
    $evidenceReason = Get-UnsafeTextReason -Value $Evidence -MaximumLength 400
    if ($null -ne $notesReason) {
        throw ("Unsafe notes rejected: {0}" -f $notesReason)
    }
    if ($null -ne $evidenceReason) {
        throw ("Unsafe evidence reference rejected: {0}" -f $evidenceReason)
    }

    $safeNotes = ConvertTo-ReportValue $Notes
    $safeEvidence = ConvertTo-ReportValue $Evidence
    $resultRecord = [pscustomobject]@{
        Stage    = $script:StageNumber
        Ticket   = $Ticket
        Check    = $Check
        Result   = $Result
        Notes    = $safeNotes
        Evidence = $safeEvidence
        Optional = $Optional
    }
    [void]$script:Results.Add($resultRecord)

    [void]$script:Report.AppendLine("### $Ticket - $Check")
    [void]$script:Report.AppendLine('')
    [void]$script:Report.AppendLine("- **Result:** $Result")
    [void]$script:Report.AppendLine(("- **Notes:** {0}" -f $(if ([string]::IsNullOrEmpty($safeNotes)) { 'None recorded' } else { $safeNotes })))
    [void]$script:Report.AppendLine(("- **Evidence reference:** {0}" -f $(if ([string]::IsNullOrEmpty($safeEvidence)) { 'None recorded' } else { $safeEvidence })))
    [void]$script:Report.AppendLine('')
    Save-Report
}

function Record-ManualCheck {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Ticket,
        [Parameter(Mandatory = $true)]
        [string]$Check,
        [bool]$PassRequirementsMet = $true,
        [switch]$RequireKnownFixConfirmation,
        [switch]$OptionalHardware
    )

    do {
        $result = (Read-Host "Result for $Check (PASS, FAIL, or SKIP)").Trim().ToUpperInvariant()
        if ($result -notin @('PASS', 'FAIL', 'SKIP')) {
            Write-Caution 'Enter PASS, FAIL, or SKIP.'
        }
    } while ($result -notin @('PASS', 'FAIL', 'SKIP'))

    $automaticNote = ''
    if ($result -eq 'PASS' -and -not $PassRequirementsMet) {
        $result = 'FAIL'
        $automaticNote = 'The temporary draft safety or deletion check was not confirmed.'
    }

    if ($result -eq 'PASS' -and $RequireKnownFixConfirmation) {
        if (-not (Read-YesNo 'Have the known game-details and Back behaviors been fixed and observed in this run?')) {
            $result = 'FAIL'
            $automaticNote = 'Keep this check FAIL until the known game-details and Back behaviors are fixed and observed.'
        }
    }

    if ($result -eq 'SKIP' -and $RequireKnownFixConfirmation) {
        $automaticNote = 'Required behavior is unproven; the ticket remains ready-for-human.'
    }

    $notes = Read-SafeText -Prompt 'Short sanitized note (empty is allowed)' -MaximumLength 500 -AllowEmpty
    if (-not [string]::IsNullOrEmpty($automaticNote)) {
        if ([string]::IsNullOrEmpty($notes)) {
            $notes = $automaticNote
        }
        else {
            $notes = "$notes $automaticNote"
        }
    }
    if ($OptionalHardware -and $result -eq 'SKIP' -and [string]::IsNullOrEmpty($notes)) {
        $notes = 'Optional hardware was unavailable; SKIP is not PASS.'
    }

    $evidence = Read-SafeText -Prompt 'Safe evidence reference (empty is allowed; no URL, path, or Markdown link)' -MaximumLength 300 -AllowEmpty
    Add-CheckResult -Ticket $Ticket -Check $Check -Result $result -Notes $notes -Evidence $evidence -Optional $OptionalHardware.IsPresent
    return $result
}

function New-SupportDraft {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApplicationVersion,
        [Parameter(Mandatory = $true)]
        [string]$WindowsVersion
    )

    Write-Instruction 'Type a temporary local draft. Local inspection of a log is allowed only to manually redact one excerpt; never copy raw logs or config into the draft. Use one redacted excerpt only.'
    $steps = Read-SafeText -Prompt 'Draft reproduction steps (no URLs, paths, credentials, tokens, or ROM names)' -MaximumLength 700
    $expected = Read-SafeText -Prompt 'Draft expected behavior (no URLs, paths, credentials, tokens, or ROM names)' -MaximumLength 500
    $actual = Read-SafeText -Prompt 'Draft actual behavior (no URLs, paths, credentials, tokens, or ROM names)' -MaximumLength 500
    $excerpt = Read-SafeText -Prompt 'One manually typed redacted excerpt (not raw log content)' -MaximumLength 700

    $draft = @"
Wingosy support draft
Application version: $ApplicationVersion
Windows version/build: $WindowsVersion
Steps: $steps
Expected behavior: $expected
Actual behavior: $actual
Redacted excerpt: $excerpt
"@

    $draftPath = $null
    $draftDeleted = $false
    $draftSafe = $false
    try {
        $draftPath = [System.IO.Path]::GetTempFileName()
        $repositoryPrefix = $script:RepositoryRoot.TrimEnd([char[]]@('\', '/')) + [System.IO.Path]::DirectorySeparatorChar
        $draftFullPath = [System.IO.Path]::GetFullPath($draftPath)
        if ($draftFullPath.StartsWith($repositoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw 'The temporary draft was not outside the repository.'
        }

        [System.IO.File]::WriteAllText($draftPath, $draft, [System.Text.UTF8Encoding]::new($false))
        Write-Instruction 'The temporary draft was created outside the repository. Its path is not recorded.'
        $draftSafe = $null -eq (Get-UnsafeTextReason -Value $draft -MaximumLength 5000)
        $draftSafe = $draftSafe -and (Read-YesNo 'Confirm the draft contains no prohibited data and only the redacted excerpt')
    }
    finally {
        if ($null -ne $draftPath) {
            try {
                if (Test-Path -LiteralPath $draftPath) {
                    Remove-Item -LiteralPath $draftPath -Force -ErrorAction Stop
                }
                if (Test-Path -LiteralPath $draftPath) {
                    throw 'The temporary draft file remains after deletion.'
                }
                $draftDeleted = $true
            }
            catch {
                Write-Caution ("Temporary draft deletion failed; local temporary file path: {0}" -f $draftPath)
                throw ("The temporary draft could not be deleted. Stop the wizard and remove it manually: {0}" -f $draftPath)
            }
        }
    }

    return $draftSafe -and $draftDeleted
}

Start-Stage 'Safety preflight and sanitized report metadata'
Write-Instruction 'Use Windows 11 with a clean isolated profile or VM. Do not use an everyday profile.'
Write-Instruction 'Make and verify a backup before testing. Keep the backup closed during the test.'
Write-Caution 'Local inspection of a log is allowed only to manually redact one excerpt. Raw logs must never be attached, copied into, or persisted in the report or evidence. Do not inspect, attach, copy, or persist config.toml, databases, credentials, tokens, ROM names or paths, RomM URLs, or personal paths.'
if (-not (Read-YesNo 'Have you made and checked the required backup?')) {
    Write-Caution 'Stopping before acceptance work. Re-run after the backup is ready.'
    exit 1
}

$windows = Get-WindowsPublicMetadata
$wingosyVersion = Read-SafeText -Prompt 'Wingosy version from Settings > General (public; empty is allowed)' -MaximumLength 100 -AllowEmpty
$commitSha = Read-CommitSha
$testerHandle = Read-SafeText -Prompt 'Non-sensitive tester handle, not a Windows account name (empty is allowed)' -MaximumLength 100 -AllowEmpty

[System.IO.Directory]::CreateDirectory($ReportDirectory) | Out-Null
if (Test-Path -LiteralPath $ReportFile) {
    throw ("The default report already exists for this timestamp: {0}" -f $ReportRelativePath)
}

[void]$Report.AppendLine("# Wingosy remaining acceptance - $RunId")
[void]$Report.AppendLine('')
[void]$Report.AppendLine("- **Report:** $ReportRelativePath")
[void]$Report.AppendLine(("- **Windows edition:** {0}" -f $(if ([string]::IsNullOrEmpty($windows.Edition)) { 'Not recorded' } else { (ConvertTo-ReportValue $windows.Edition) })))
[void]$Report.AppendLine(("- **Windows version:** {0}" -f $(if ([string]::IsNullOrEmpty($windows.Version)) { 'Not recorded' } else { (ConvertTo-ReportValue $windows.Version) })))
[void]$Report.AppendLine(("- **Windows build:** {0}" -f $(if ([string]::IsNullOrEmpty($windows.Build)) { 'Not recorded' } else { (ConvertTo-ReportValue $windows.Build) })))
[void]$Report.AppendLine(("- **Wingosy:** {0}" -f $(if ([string]::IsNullOrEmpty($wingosyVersion)) { 'Not recorded' } else { (ConvertTo-ReportValue $wingosyVersion) })))
[void]$Report.AppendLine(("- **Commit:** {0}" -f $(if ([string]::IsNullOrEmpty($commitSha)) { 'Not recorded' } else { (ConvertTo-ReportValue $commitSha) })))
[void]$Report.AppendLine(("- **Tester:** {0}" -f $(if ([string]::IsNullOrEmpty($testerHandle)) { 'Not recorded' } else { (ConvertTo-ReportValue $testerHandle) })))
[void]$Report.AppendLine('- **Safety:** Local inspection of a log is allowed only to manually redact one excerpt. Raw logs must never be attached, copied into, or persisted in this report or its evidence; raw config, screenshots with paths, ROM names, RomM URLs, credentials, tokens, and personal paths must not enter this report.')
[void]$Report.AppendLine('- **Prior PASS preserved:** This run does not repeat Ticket 02 paired setup, Ticket 03 credential lifecycle, or Ticket 04 immersive loading.')
[void]$Report.AppendLine('')
Add-StageHeading 'Safety preflight and sanitized report metadata'
Save-Report
Add-CheckResult -Ticket 'Safety' -Check 'Backup and sanitized public metadata' -Result 'PASS' -Notes 'Backup confirmed. Only public metadata is recorded; blank metadata values remain blank.' -Evidence ''
Wait-ForUser 'Press Enter when the isolated test profile or VM is ready.'

Start-Stage 'Ticket 02 local-only setup only'
Add-StageHeading 'Ticket 02 local-only setup only'
Write-Instruction 'Use a clean isolated profile or VM. Do not pair with RomM.'
Write-Instruction 'Choose the local-only path, select Finish, fully exit Wingosy, and restart it.'
Write-Instruction 'Confirm the library and Settings open without requiring RomM.'
Write-Instruction 'An unavailable BIOS feature that requires RomM is not itself a failure of local-only setup.'
Write-Caution 'Do not inspect or attach the resulting configuration.'
Wait-ForUser 'Complete the local-only flow, then press Enter.'
[void](Record-ManualCheck -Ticket 'Ticket 02' -Check 'Local-only setup, Finish, restart, library, and Settings')

Start-Stage 'Ticket 04 desktop pagination only'
Add-StageHeading 'Ticket 04 desktop pagination only'
Write-Instruction 'Use a representative large library in desktop mode.'
Write-Instruction 'Verify a bounded first page, then use Next, Previous, and a distant or last page.'
Write-Instruction 'Confirm the page indicator and visible cards change on every page.'
Write-Instruction 'Change search text and the platform filter. Confirm each change resets to page 1.'
Write-Instruction 'Confirm there is no stale, blank, or duplicate page, and keyboard and mouse focus still work.'
Write-Instruction 'Animation polish and immersive search or filter controls are out of scope for this stage.'
Wait-ForUser 'Complete the desktop pagination checks, then press Enter.'
[void](Record-ManualCheck -Ticket 'Ticket 04' -Check 'Desktop bounded pagination, page controls, filters, and focus')

Start-Stage 'Ticket 07 technical support path only'
Add-StageHeading 'Ticket 07 technical support path only'
Write-Instruction 'Open Settings > General > Open Logs Folder. Confirm it matches the documented logs location without recording the path.'
Write-Instruction 'Click Report a Problem. Confirm the canonical GitHub bug-report form opens. Do not submit it.'
Write-Instruction 'Create the temporary local draft outside the repository with app and Windows versions, steps, expected and actual behavior, and one redacted excerpt.'
Write-Instruction 'Confirm the draft has no raw logs, raw config, screenshots with paths, ROM names or paths, RomM URLs, credentials, tokens, or personal paths. Delete the draft.'
Write-Caution 'Do not paste any prohibited data into the draft or this report.'
$draftWindows = "$($windows.Edition) $($windows.Version) $($windows.Build)".Trim()
if ([string]::IsNullOrWhiteSpace($draftWindows)) {
    $draftWindows = 'Not recorded'
}
$draftApplication = if ([string]::IsNullOrWhiteSpace($wingosyVersion)) { 'Not recorded' } else { $wingosyVersion }
$draftWasSafeAndDeleted = New-SupportDraft -ApplicationVersion $draftApplication -WindowsVersion $draftWindows
Wait-ForUser 'Finish the support-path checks, then press Enter.'
[void](Record-ManualCheck -Ticket 'Ticket 07' -Check 'Logs location, bug-report form, and deleted safe draft' -PassRequirementsMet $draftWasSafeAndDeleted)

Start-Stage 'Ticket 09 primary controller'
Add-StageHeading 'Ticket 09 primary controller'
Write-Instruction 'First verify keyboard fallback: arrows navigate, Enter confirms, and Esc goes back.'
Write-Instruction 'Set Controller deadzone only within 0.10 to 0.80. Restart Wingosy and confirm it persists. Reset it to 0.35 and confirm that persists.'
Write-Instruction 'Use a standard or XInput controller. Confirm navigation uses the active controller without duplicate actions.'
Write-Instruction 'Confirm/Open enters game details and activates the selected primary action once.'
Write-Instruction 'Back from details returns to the library. Back at the library root opens exit confirmation; cancelling remains in Immersive mode.'
Write-Instruction 'Menu opens Settings.'
Write-Instruction 'Disconnect and reconnect the controller. Confirm no input remains held, no action duplicates, and no restart is needed.'
Write-Caution 'Keep this check FAIL until the known game-details and Back behavior is fixed and observed in this run.'
Wait-ForUser 'Complete the primary controller checks, then press Enter.'
[void](Record-ManualCheck -Ticket 'Ticket 09' -Check 'Primary controller navigation, deadzone, details, Back, Menu, and hot-plug' -RequireKnownFixConfirmation)

Start-Stage 'Ticket 09 optional hardware'
Add-StageHeading 'Ticket 09 optional hardware'
if (Read-YesNo 'Is a second standard controller available for this check?') {
    Write-Instruction 'Connect the second standard controller. Verify handoff works and one input never produces duplicate launcher actions.'
    Wait-ForUser 'Complete the second standard controller check, then press Enter.'
    [void](Record-ManualCheck -Ticket 'Ticket 09' -Check 'Second standard controller handoff' -OptionalHardware)
}
else {
    Add-CheckResult -Ticket 'Ticket 09' -Check 'Second standard controller handoff' -Result 'SKIP' -Notes 'Optional hardware was unavailable; SKIP is not PASS.' -Evidence '' -Optional $true
}

if (Read-YesNo 'Is an unsupported pad available for this check?') {
    Write-Instruction 'Connect the unsupported pad. It must emit no launcher action while keyboard input continues to work.'
    Wait-ForUser 'Complete the unsupported-pad boundary check, then press Enter.'
    [void](Record-ManualCheck -Ticket 'Ticket 09' -Check 'Unsupported-pad boundary' -OptionalHardware)
}
else {
    Add-CheckResult -Ticket 'Ticket 09' -Check 'Unsupported-pad boundary' -Result 'SKIP' -Notes 'Optional hardware was unavailable; SKIP is not PASS.' -Evidence '' -Optional $true
}

Start-Stage 'Review and closeout'
Add-StageHeading 'Review and closeout'
$passCount = @($Results | Where-Object { $_.Result -eq 'PASS' }).Count
$failCount = @($Results | Where-Object { $_.Result -eq 'FAIL' }).Count
$skipCount = @($Results | Where-Object { $_.Result -eq 'SKIP' }).Count
$requiredSkipCount = @($Results | Where-Object { -not $_.Optional -and $_.Result -eq 'SKIP' }).Count
$optionalSkipCount = @($Results | Where-Object { $_.Optional -and $_.Result -eq 'SKIP' }).Count
$closeoutResult = if ($failCount -gt 0) { 'FAIL' } elseif ($requiredSkipCount -gt 0) { 'SKIP' } else { 'PASS' }

Write-Instruction "Report: $ReportRelativePath"
Write-Instruction ("Results before closeout: PASS {0}, FAIL {1}, SKIP {2}." -f $passCount, $failCount, $skipCount)
if ($failCount -gt 0) {
    Write-Caution 'Any FAIL keeps its ticket ready-for-human.'
}
if ($requiredSkipCount -gt 0) {
    Write-Caution 'A required SKIP cannot resolve its ticket.'
}
if ($optionalSkipCount -gt 0) {
    Write-Caution 'Optional hardware remains unproven; optional SKIP does not change closeout classification.'
}
Write-Instruction 'Keep raw evidence outside the repository.'
Write-Instruction 'After review, add only a dated sanitized ticket comment. Do not mutate tickets or STATE automatically.'

[void]$Report.AppendLine("- **Result counts before closeout:** PASS $passCount, FAIL $failCount, SKIP $skipCount")
[void]$Report.AppendLine("- **Required SKIP count:** $requiredSkipCount")
[void]$Report.AppendLine("- **Optional SKIP count:** $optionalSkipCount")
[void]$Report.AppendLine('- **Closeout rule:** Any FAIL keeps its ticket ready-for-human; a required SKIP cannot resolve its ticket; optional hardware SKIP does not change closeout classification.')
[void]$Report.AppendLine('')
Save-Report
Add-CheckResult -Ticket 'Review' -Check 'Report review and closeout rules' -Result $closeoutResult -Notes ("Report path is $ReportRelativePath. Result counts before closeout: PASS $passCount, FAIL $failCount, SKIP $skipCount. Raw evidence stays outside the repository; add only a dated sanitized ticket comment after review.") -Evidence 'Report summary above'

Clear-FocusedStage
Write-Host ''
Write-Host 'Acceptance wizard complete.' -ForegroundColor Green
Write-Host ("Report: {0}" -f $ReportRelativePath)
$finalPassCount = @($Results | Where-Object { $_.Result -eq 'PASS' }).Count
$finalFailCount = @($Results | Where-Object { $_.Result -eq 'FAIL' }).Count
$finalSkipCount = @($Results | Where-Object { $_.Result -eq 'SKIP' }).Count
Write-Host ("Final counts including closeout: PASS {0}, FAIL {1}, SKIP {2}" -f $finalPassCount, $finalFailCount, $finalSkipCount)
Write-Host 'Review the report before adding any dated sanitized ticket comment.'
