package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// embeddedBinary is defined in platform-specific files:
// - main_linux.go for Linux
// - main_darwin.go for macOS
// - main_windows.go for Windows

func main() {
	// Check platform support
	if runtime.GOOS != "linux" && runtime.GOOS != "darwin" && runtime.GOOS != "windows" {
		fmt.Fprintf(os.Stderr, "Unsupported platform: %s\n", runtime.GOOS)
		os.Exit(1)
	}

	if len(embeddedBinary) == 0 {
		fmt.Fprintf(os.Stderr, "No binary embedded for platform: %s\n", runtime.GOOS)
		os.Exit(1)
	}

	// Determine binary name based on platform
	var binaryName string
	if runtime.GOOS == "windows" {
		binaryName = "pcs.exe"
	} else {
		binaryName = "pcs"
	}

	// Try to use home directory first, fallback to temp directory
	var binaryPath string
	var err error
	
	homeDir, err := os.UserHomeDir()
	if err == nil {
		// Home directory available - use ~/.pcs/
		pcsDir := filepath.Join(homeDir, ".pcs")
		
		// Create directory if it doesn't exist
		err = os.MkdirAll(pcsDir, 0755)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: Failed to create ~/.pcs directory: %v\n", err)
			fmt.Fprintf(os.Stderr, "Falling back to temporary directory...\n")
			// Fallback to temp directory
			binaryPath, err = createTempBinary(binaryName)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Failed to create temporary file: %v\n", err)
				os.Exit(1)
			}
		} else {
			binaryPath = filepath.Join(pcsDir, binaryName)
		}
	} else {
		// Home directory not available - use temp directory
		fmt.Fprintf(os.Stderr, "Warning: Could not determine home directory: %v\n", err)
		fmt.Fprintf(os.Stderr, "Falling back to temporary directory...\n")
		binaryPath, err = createTempBinary(binaryName)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to create temporary file: %v\n", err)
			os.Exit(1)
		}
	}

	// Check if binary already exists and matches size (reuse detection)
	needsExtraction := true
	if fileInfo, err := os.Stat(binaryPath); err == nil {
		// File exists - check size
		if fileInfo.Size() == int64(len(embeddedBinary)) {
			// Size matches - reuse existing binary
			needsExtraction = false
		}
	}

	// Extract binary only if needed
	if needsExtraction {
		err = os.WriteFile(binaryPath, embeddedBinary, 0755)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to write binary: %v\n", err)
			os.Exit(1)
		}

		// Ensure the file has execute permissions
		err = os.Chmod(binaryPath, 0755)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to set execute permissions: %v\n", err)
			os.Exit(1)
		}
	}

	// Execute the binary with all passed arguments
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, binaryPath, os.Args[1:]...)
	
	// Pass through stdin, stdout, stderr
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// Run the command
	err = cmd.Run()
	if err != nil {
		// If the command exits with an error, capture the exit code
		if exitError, ok := err.(*exec.ExitError); ok {
			os.Exit(exitError.ExitCode())
		}
		fmt.Fprintf(os.Stderr, "Failed to execute binary: %v\n", err)
		os.Exit(1)
	}
}

// createTempBinary creates a temporary file for the binary and returns its path
func createTempBinary(binaryName string) (string, error) {
	var tmpFile *os.File
	var err error
	
	if runtime.GOOS == "windows" {
		tmpFile, err = os.CreateTemp("", "pcs-*.exe")
	} else {
		tmpFile, err = os.CreateTemp("", "pcs-*")
	}
	
	if err != nil {
		return "", err
	}
	
	tmpFilePath := tmpFile.Name()
	tmpFile.Close()
	
	return tmpFilePath, nil
}

