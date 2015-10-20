// #if NODE
// ------------------------------------------------------------------------------
// Based on a forked version of a-promise module
// Original version: https://github.com/steelbrain/a-promise
// Forked version: https://github.com/lukaaash/a-promise/blob/steelbrian/a-plus-compliance/Source/Promise.js
// License: The MIT License (MIT)
// Copyright: Copyright(c) 2015 Steel Brain
// ------------------------------------------------------------------------------
"use strict"
// State:Pending = 0
// State:Success = 1
// State:Failure = 2
// #endif
class APromise {
    private State: number
    private OnError: Array<Function>
    private OnSuccess: Array<Function>
    private Result: any
    private Finished: boolean

    constructor(Callback, Skip) {
        this.State = 0
        this.OnError = null
        this.OnSuccess = null
        this.Result = null
        this.Finished = false
        if (!Skip) {
            if (typeof Callback !== "function") throw new TypeError("Promise resolver " + Callback + " is not a function")
            let Me = this
            Callback(function (Result) {
                if (!Me.Finished) {
                    Me.Finished = true
                    Me.resolve(Result)
                }
            }, function (Result) {
                if (!Me.Finished) {
                    Me.Finished = true
                    Me.reject(Result)
                }
            })
        }
    }
    onError(Callback) {
        if (this.State === 0) {
            this.OnError = this.OnError || []
            this.OnError.push(Callback)
        }
        else if (this.State === 2) {
            let Me = this
            setTimeout(function () {
                Callback(Me.Result)
            }, 0)
        }
    }
    onSuccess(Callback) {
        if (this.State === 0) {
            this.OnSuccess = this.OnSuccess || []
            this.OnSuccess.push(Callback)
        }
        else if (this.State === 1) {
            let Me = this
            setTimeout(function () {
                Callback(Me.Result)
            }, 0)
        }
    }
    resolve(Value) {
        if (this.State === 0) {
            if (Value === this) {
                return this.reject(new TypeError("Can't resolve with self"))
            }
            let Me = this
            if (Value && Value.then) {
                let Instance = Value.then(function (Value) { return Value })
                Instance.then(function (Value) { Me.resolve(Value) }, function (Value) { Me.reject(Value) })
            } else {
                this.State = 1
                this.Result = Value
                setTimeout(function () {
                    if (Me.OnSuccess) Me.OnSuccess.forEach(function (OnSuccess) { OnSuccess(Value) })
                }, 0)
            }
        }
    }
    reject(Value) {
        if (this.State === 0) {
            if (Value === this) {
                return this.reject(new TypeError("Can't resolve with self"))
            }
            let Me = this
            if (Value && Value.then) {
                let Instance = Value.then(function (Value) { return Value })
                Instance.then(function (Value) { Me.resolve(Value) }, function (Value) { Me.reject(Value) })
            } else {
                this.State = 2
                this.Result = Value
                setTimeout(function () {
                    if (Me.OnError) Me.OnError.forEach(function (OnSuccess) { OnSuccess(Value) })
                }, 0)
            }
        }
    }
    then(CallbackS, CallbackE) {
        let Instance = new APromise(null, true)
        this.onSuccess(function (Value) {
            try {
                if (typeof CallbackS === 'function') Instance.resolve(CallbackS(Value))
                else Instance.resolve(Value)
            } catch (err) {
                Instance.reject(err)
            }
        })
        this.onError(function (Value) {
            try {
                if (typeof CallbackE === 'function') Instance.resolve(CallbackE(Value))
                else Instance.reject(Value)
            } catch (err) {
                Instance.reject(err)
            }
        })
        return Instance
    }
    catch(CallbackE) {
        let Instance = new APromise(null, true)
        this.onSuccess(function (Value) {
            Instance.resolve(Value)
        })
        this.onError(function (Value) {
            try {
                if (typeof CallbackE === 'function') Instance.resolve(CallbackE(Value))
                else Instance.reject(Value)
            } catch (err) {
                Instance.reject(err)
            }
        })
        return Instance
    }
    static all(Iterable) {
        if (typeof Iterable === 'undefined') throw new Error("Promise.all expects parameter one to be an iteratable")
        let Instance = new APromise(null, true)
        let Promises = []
        let ToReturn = []
        let Number = 0
        for (var Index in Iterable) {
            let Val = Iterable[Index]
            if (Val && Val.then) Promises[Number] = Val
            else ToReturn[Number] = Val
            ++Number
        }
        if (Number === ToReturn.length) Instance.resolve(ToReturn)
        else Promises.forEach(function (Value, Index) {
            Value.then(function (TheVal) {
                ToReturn[Index] = TheVal
                if (Number === ToReturn.length) Instance.resolve(ToReturn)
            });
        })
        return Instance
    }
    static defer() {
        let Instance = new APromise(null, true)
        return {
            promise: Instance,
            resolve: function (Value) { Instance.resolve(Value) },
            reject: function (Value) { Instance.reject(Value) }
        }
    }
    static resolve(Value) {
        let Instance = new APromise(null, true)
        Instance.State = 1
        Instance.Result = Value
        return Instance
    }
    static reject(Value) {
        let Instance = new APromise(null, true)
        Instance.State = 2
        Instance.Result = Value
        return Instance
    }
}

export = APromise
