// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Import the interface directly from GitHub
import "https://raw.githubusercontent.com/vocdoni/davinci-contracts/main/src/interfaces/IProcessRegistry.sol"; // :contentReference[oaicite:0]{index=0}

contract ProcessTester {
    /// @notice The registry we’ll query
    IProcessRegistry public registry;

    /// @param _registry The address of your deployed IProcessRegistry
    constructor(address _registry) {
        registry = IProcessRegistry(_registry);
    }

    /// @notice Fetches the full Process struct for a given `processId`
    /// @param processId The id returned by newProcess or getNextProcessId
    /// @return p All the fields defined in IProcessRegistry.Process
    function fetchFullProcess(bytes32 processId)
        external
        view
        returns (IProcessRegistry.Process memory p)
    {
        p = registry.getProcess(processId);
    }

    /// @notice A simpler test: just get status, startTime and duration
    /// @return status The ProcessStatus enum (0=READY, 1=ENDED, …)
    /// @return startTime UNIX timestamp when it began
    /// @return duration How long it runs for (in seconds)
    function getBasicInfo(bytes32 processId)
        external
        view
        returns (
            IProcessRegistry.ProcessStatus status,
            uint256 startTime,
            uint256 duration
        )
    {
        IProcessRegistry.Process memory p = registry.getProcess(processId);
        return (p.status, p.startTime, p.duration);
    }

    /// @notice Grab the computed end time directly
    function getEndTime(bytes32 processId) external view returns (uint256) {
        return registry.getProcessEndTime(processId);
    }
}
