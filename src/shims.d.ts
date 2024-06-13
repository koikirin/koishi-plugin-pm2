/// <reference types="pm2" />

declare module 'pm2' {
  interface Pm2Env {
    axm_monitor?: {
      [key: string]: {
        type: string
        value: any
        historic?: boolean
        unit?: string
      }
    }
  }
}

declare module 'pm2/lib/API' {
  import { EventEmitter } from 'events'

  export interface PM2ConstructorOptions {
    /** Override pm2 cwd for starting scripts */
    cwd?: string
    /** PM2 directory for log, pids, socket files */
    pm2_home?: string
    /** Unique PM2 instance (random pm2_home) */
    independent?: boolean
    /** Should be called in the same process or not */
    daemon_mode?: boolean
    /** PM2 Plus bucket public key */
    public_key?: string
    /** PM2 Plus bucket secret key */
    secret_key?: string
    /** PM2 Plus instance name */
    machine_name?: string
  }

  export interface StartOptions {
    /** Process name */
    name?: string
    /** Watch for file changes */
    watch?: boolean | string[]
    /** Ignore watch patterns */
    ignore_watch?: string | string[]
    /** Watch delay in milliseconds */
    watchDelay?: string | number
    /** Script arguments */
    scriptArgs?: string[]
    /** Raw arguments */
    rawArgs?: string[]
    /** Number of instances */
    instances?: number
    /** Execution mode */
    exec_mode?: 'fork' | 'cluster'
    /** Environment name */
    env?: string
    /** Force restart */
    force?: boolean
    /** Update environment variables */
    updateEnv?: boolean
    /** Write configuration to file */
    write?: boolean
    /** Extension to watch */
    ext?: string
    /** Namespace */
    namespace?: string
    /** UID to run process as */
    uid?: string
    /** GID to run process as */
    gid?: string
    /** Only start specific apps (comma-separated) */
    only?: string
    /** Install URL for modules */
    install_url?: string
    /** Append environment to name */
    append_env_to_name?: boolean
    /** Name prefix */
    name_prefix?: string
    /** Force name */
    force_name?: string
    /** Started as module */
    started_as_module?: boolean
    /** Auto-attach to logs after start */
    attach?: boolean
    /** Commands */
    commands?: any
    /** Run in parallel */
    parallel?: number
    /** Current working directory */
    cwd?: string
    [key: string]: any
  }

  export interface ProcessDescription {
    /** Process ID */
    pm_id: number
    /** Process name */
    name: string
    /** Process namespace */
    namespace?: string
    /** PM2 environment */
    pm2_env: {
      /** Process name */
      name: string
      /** Namespace */
      namespace?: string
      /** Process ID */
      pm_id: number
      /** Process status */
      status: string
      /** Restart time */
      restart_time: number
      /** Execution path */
      pm_exec_path?: string
      /** Cron restart pattern */
      cron_restart?: string
      /** Environment variables */
      env?: { [key: string]: any }
      /** Wait for ready signal */
      wait_ready?: boolean
      [key: string]: any
    }
    /** Process PID */
    pid?: number
    /** CPU usage */
    monit?: {
      cpu: number
      memory: number
    }
  }

  export interface ProcessList extends Array<ProcessDescription> { }

  export interface ConnectionMetadata {
    /** Whether this is a new PM2 instance */
    new_pm2_instance: boolean
    /** PM2 version */
    pm2_version?: string
    [key: string]: any
  }

  export interface BusEventPacket {
    /** Process information */
    process: {
      name: string
      pm_id: number
      namespace?: string
      [key: string]: any
    }
    /** Log data */
    data?: string
    /** Event timestamp */
    at?: number
    /** Event name */
    event?: string
    [key: string]: any
  }

  /**
   * Main PM2 API Class
   *
   * @example
   * ```typescript
   * import PM2 from 'pm2';
   *
   * const pm2 = new PM2({
   *   pm2_home: '/custom/path/. pm2'
   * });
   *
   * pm2.connect((err) => {
   *   if (err) throw err;
   *
   *   pm2.start('app. js', (err, apps) => {
   *     pm2.disconnect();
   *   });
   * });
   * ```
   */
  export class API {
    /** Whether PM2 runs as daemon */
    daemon_mode: boolean
    /** PM2 home directory */
    pm2_home: string
    /** PM2 Plus public key */
    public_key: string | null
    /** PM2 Plus secret key */
    secret_key: string | null
    /** PM2 Plus machine name */
    machine_name: string | null
    /** Current working directory */
    cwd: string
    /** PM2 Client instance */
    Client: any
    /** PM2 configuration */
    pm2_configuration: { [key: string]: any }
    /** PM2 Plus interaction info */
    gl_interact_infos: any
    /** Whether linked to PM2 Plus */
    gl_is_km_linked: boolean

    constructor(opts?: PM2ConstructorOptions)

    /// //////////////////////////
    // Connection Management   //
    /// //////////////////////////

    /**
     * Connect to PM2 daemon
     * @param noDaemon - Disable daemon mode
     * @param cb - Callback once PM2 is ready
     */
    connect(cb: (err: Error | null, meta?: ConnectionMetadata) => void): void
    connect(noDaemon: boolean, cb: (err: Error | null, meta?: ConnectionMetadata) => void): void

    /**
     * Disconnect from PM2 instance
     * @param cb - Optional callback once connection closed
     */
    disconnect(cb?: (err: Error | null, data?: any) => void): void

    /**
     * Alias for disconnect
     * @param cb - Optional callback once connection closed
     */
    close(cb?: (err: Error | null, data?: any) => void): void

    /**
     * Cleanup PM2 instance (for independent instances)
     * @param cb - Callback once cleanup is successful
     */
    destroy(cb: (err: Error | null) => void): void

    /**
     * Exit CLI with code
     * @param code - Exit code
     */
    exitCli(code: number): void

    /// //////////////////////////
    // Module Management       //
    /// //////////////////////////

    /**
     * Launch PM2 modules
     * @param cb - Callback once modules are launched
     */
    launchModules(cb: (err: Error | null) => void): void

    /**
     * Enable event bus for retrieving process events
     * @param cb - Callback with bus instance
     */
    launchBus(cb: (err: Error | null, bus?: EventEmitter, socket?: any) => void): void

    /// //////////////////////////
    // Process Management      //
    /// //////////////////////////

    /**
     * Start a process or application
     * @param cmd - Script path, JSON config file, or config object
     * @param opts - Start options
     * @param cb - Callback once application started
     */
    start(cmd: string | object, cb?: (err: Error | null, procs?: ProcessList) => void): void
    start(cmd: string | object, opts: StartOptions, cb?: (err: Error | null, procs?: ProcessList) => void): void

    /**
     * Restart a process
     * @param cmd - Process name, ID, config file, or 'all'
     * @param opts - Restart options
     * @param cb - Callback once restarted
     */
    restart(cmd: string | number, cb?: (err: Error | null, procs?: ProcessList) => void): void
    restart(cmd: string | number, opts: StartOptions, cb?: (err: Error | null, procs?: ProcessList) => void): void

    /**
     * Reload a process (zero-downtime restart)
     * @param process_name - Process name or 'all'
     * @param opts - Reload options
     * @param cb - Callback once reloaded
     */
    reload(process_name: string, cb?: (err: Error | null, procs?: ProcessList) => void): void
    reload(process_name: string, opts: StartOptions, cb?: (err: Error | null, procs?: ProcessList) => void): void

    /**
     * Stop a process
     * @param process_name - Process name, ID, config file, or 'all'
     * @param cb - Callback once stopped
     */
    stop(process_name: string | number, cb?: (err: Error | null, procs?: ProcessList) => void): void

    /**
     * Delete a process from PM2
     * @param process_name - Process name, ID, config file, or 'all'
     * @param jsonVia - JSON processing type ('pipe' or 'file')
     * @param cb - Callback once deleted
     */
    delete(process_name: string | number, cb?: (err: Error | null, procs?: ProcessList) => void): void
    delete(process_name: string | number, jsonVia: string, cb?: (err: Error | null, procs?: ProcessList) => void): void

    /**
     * Reset process metadata (restart count, uptime, etc.)
     * @param process_name - Process name, ID, or 'all'
     * @param cb - Callback once reset
     */
    reset(process_name: string | number, cb?: (err: Error | null, result?: { success: boolean }) => void): void

    /**
     * Scale process instances up or down
     * @param app_name - Application name
     * @param number - Target number of instances or '+2'/'-2' for relative scaling
     * @param cb - Callback once scaled
     */
    scale(app_name: string, number: number | string, cb?: (err: Error | null, result?: { success: boolean }) => void): void

    /**
     * Get list of all managed processes
     * @param opts - List options
     * @param cb - Callback with process list
     */
    list(cb?: (err: Error | null, list?: ProcessList) => void): void
    list(opts: { rawArgs?: string[] }, cb?: (err: Error | null, list?: ProcessList) => void): void

    /**
     * Describe a process in detail
     * @param pm2_id - Process ID or name
     * @param cb - Callback with process details
     */
    describe(pm2_id: string | number, cb?: (err: Error | null, procs?: ProcessDescription[]) => void): void

    /**
     * Get process list as JSON
     * @param debug - Enable debug output
     */
    jlist(debug?: boolean): void

    /**
     * Display system information
     * @param tree - Display as tree structure
     */
    slist(tree?: boolean): void

    /**
     * Fast process list display
     * @param code - Exit code
     * @param apps_acted - Apps that were acted upon
     */
    speedList(code?: number | null, apps_acted?: ProcessDescription[]): void | boolean

    /**
     * Get process ID by name
     * @param name - Process name
     * @param cb - Callback with process IDs
     */
    getProcessIdByName(name: string, cb: (err: Error | null, ids?: number[]) => void): void

    /// //////////////////////////
    // Daemon Management       //
    /// //////////////////////////

    /**
     * Kill PM2 daemon
     * @param cb - Callback once daemon is killed
     */
    killDaemon(cb?: (err: Error | null, res?: any) => void): void

    /**
     * Alias for killDaemon
     * @param cb - Callback once daemon is killed
     */
    kill(cb?: (err: Error | null, res?: any) => void): void

    /**
     * Update PM2 daemon
     * @param cb - Callback once updated
     */
    update(cb?: (err: Error | null, result?: { success: boolean }) => void): void

    /**
     * Perform deep update of PM2 (npm install + update)
     * @param cb - Callback once updated
     */
    deepUpdate(cb?: (err: Error | null, result?: { success: boolean }) => void): void

    /// //////////////////////////
    // Internal Methods        //
    /// //////////////////////////

    /**
     * Internal method to start a script
     * @private
     */
    _startScript(script: string, opts: StartOptions, cb: (err: Error | null, procs?: ProcessList) => void): void

    /**
     * Internal method to start from JSON
     * @private
     */
    _startJson(
      file: string | object,
      opts: StartOptions,
      action: string,
      pipe: string | ((err: Error | null, procs?: ProcessList) => void),
      cb?: (err: Error | null, procs?: ProcessList) => void
    ): void

    /**
     * Internal method to perform operations on processes
     * @private
     */
    _operate(
      action_name: string,
      process_name: string | number,
      envs?: any,
      cb?: (err: Error | null, procs?: ProcessList) => void
    ): void

    /**
     * Internal method to handle attribute updates
     * @private
     */
    _handleAttributeUpdate(opts: any): any

    /**
     * Apply RPC method from JSON file
     * @param action - RPC method name
     * @param file - File path or config object
     * @param opts - Options
     * @param jsonVia - Processing type ('pipe' or 'file')
     * @param cb - Callback
     */
    actionFromJson(
      action: string,
      file: string | object,
      opts: any,
      jsonVia: string,
      cb: (err: Error | null, procs?: ProcessList) => void
    ): void;

    /// //////////////////////////
    // Additional Methods      //
    // (loaded from other files)//
    /// //////////////////////////

    /**
     * Additional methods loaded from:
     * - ./API/Extra.js (dump, restore, etc.)
     * - ./API/Deploy.js (deployment methods)
     * - ./API/Modules/index.js (module management)
     * - ./API/pm2-plus/link.js (PM2 Plus linking)
     * - ./API/pm2-plus/process-selector.js (process selection)
     * - ./API/pm2-plus/helpers. js (helper methods)
     * - ./API/Configuration.js (configuration methods)
     * - ./API/Version.js (version methods)
     * - ./API/Startup.js (startup script methods)
     * - ./API/LogManagement.js (log methods like streamLogs)
     * - ./API/Containerizer.js (container methods)
     *
     * Common additional methods include:
     * - dump(cb): Dump process list
     * - resurrect(cb): Resurrect saved processes
     * - sendLineToStdin(pm_id, line, cb): Send input to process
     * - sendDataToProcessId(pm_id, packet, cb): Send data to process
     * - streamLogs(id, lines, raw, timestamp, exclusive): Stream logs
     * - killAgent(cb): Kill PM2 Plus agent
     * - launchSysMonitoring(cb): Launch system monitoring
     * - getVersion(cb): Get PM2 version
     * - install(module, opts, cb): Install module
     * - uninstall(module, cb): Uninstall module
     */
    [key: string]: any;
  }

  export default API
}

declare module 'pm2/lib/API/Log' {

  export interface AppLogInfo {
    path: string
    type: 'out' | 'err' | 'PM2'
    app_name: string
  }

  export interface PM2Client {
    launchBus(callback: (err: Error | null, bus: any, socket?: any) => void): void
  }

  export interface Log {
    /**
     * Tail logs from file stream.
     * @param apps_list - List of applications with log information
     * @param lines - Number of lines to tail
     * @param raw - Whether to output raw logs without formatting
     * @param callback - Optional callback function
     */
    tail(
      apps_list: AppLogInfo[],
      lines: number,
      raw: boolean,
      callback?: () => void
    ): void

    /**
     * Stream logs in realtime from the bus eventemitter.
     * @param Client - PM2 client instance
     * @param id - Process ID, name, namespace, or 'all'
     * @param raw - Whether to output raw logs without formatting
     * @param timestamp - Timestamp format string or false
     * @param exclusive - Filter by log type ('out', 'err') or false for all
     * @param highlight - Text to highlight in the output
     */
    stream(
      Client: PM2Client,
      id: string | number,
      raw: boolean,
      timestamp: string | false,
      exclusive: 'out' | 'err' | false,
      highlight?: string
    ): void

    /**
     * Stream logs in development mode with auto-restart notifications.
     * @param Client - PM2 client instance
     * @param id - Process ID, name, or 'all'
     * @param raw - Whether to output raw logs without formatting
     * @param timestamp - Timestamp format string or false
     * @param exclusive - Filter by log type ('out', 'err') or false for all
     */
    devStream(
      Client: PM2Client,
      id: string | number,
      raw: boolean,
      timestamp: string | false,
      exclusive: 'out' | 'err' | false
    ): void

    /**
     * Stream logs in JSON format.
     * @param Client - PM2 client instance
     * @param id - Process ID, name, or 'all'
     */
    jsonStream(Client: PM2Client, id: string | number): void

    /**
     * Stream logs with custom formatting.
     * @param Client - PM2 client instance
     * @param id - Process ID, name, or 'all'
     * @param raw - Whether to output raw logs without formatting
     * @param timestamp - Timestamp format string or false
     * @param exclusive - Filter by log type ('out', 'err') or false for all
     * @param highlight - Text to highlight in the output
     */
    formatStream(
      Client: PM2Client,
      id: string | number,
      raw: boolean,
      timestamp: string | false,
      exclusive: 'out' | 'err' | false,
      highlight?: string
    ): void
  }

  export const Log: Log

  export default Log
}

declare module 'pm2/lib/API' {

  export class API {
    /**
     * Trigger a PMX custom action in target application
     * Custom actions allows to interact with an application
     *
     * @method trigger
     * @param  {String|Number} pm_id       process id or application name
     * @param  {String}        action_name name of the custom action to trigger
     * @param  {Mixed}         params      parameter to pass to target action
     * @param  {Function}      cb          callback
     */
    trigger(
      pm_id: string | number,
      action_name: string,
      params: any,
      cb: (err: Error | null, responses?: any[]) => void
    ): void
  }
}
