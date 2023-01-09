$RUN_BIN = $MyInvocation.MyCommand.Path
$RUN_DIR = Split-Path -parent $RUN_BIN
$RUN_SCRIPTS_DIR = Join-Path -Path $RUN_DIR -ChildPath "scripts"

if ($args.length -eq 0) {
  (ls -n $RUN_SCRIPTS_DIR) -split "`n" -join " "
  exit 0
}

$RUN_TASK, $RUN_ARGS = $args

$SCRIPT_FULL_PATH = Join-Path -Path $RUN_SCRIPTS_DIR -ChildPath $RUN_TASK
$SCRIPT_FULL_PATH_PS1 = -join($SCRIPT_FULL_PATH, ".ps1")
if ([System.IO.File]::Exists($SCRIPT_FULL_PATH_PS1)) {
  $env:RUN_BIN=$RUN_BIN
  $env:RUN_DIR=$RUN_DIR
  $env:RUN_TASK=$RUN_TASK

  & "$SCRIPT_FULL_PATH_PS1" $RUN_ARGS
  exit $lastexitcode
} else {
  # -EA Continue required to set the correct exit code
  # (because we could have set $ErrorActionPreference = "Stop")
  # see https://stackoverflow.com/questions/73344421/
  Write-Error "Task not found: $RUN_TASK" -EA Continue
  exit 2
}
