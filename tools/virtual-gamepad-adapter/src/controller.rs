use crate::protocol::{NativeX360Report, NormalizedState};
#[cfg(test)]
use std::cell::RefCell;
#[cfg(test)]
use std::rc::Rc;

pub(crate) trait ReportSink {
    fn dispatch(&mut self, report: NativeX360Report) -> Result<(), String>;
}

pub(crate) struct Controller<S> {
    sink: S,
}

#[cfg(test)]
pub(crate) struct RecordingSink {
    reports: Rc<RefCell<Vec<NativeX360Report>>>,
    dispatch_error: Option<String>,
}

#[cfg(test)]
pub(crate) fn recording_sink() -> (RecordingSink, Rc<RefCell<Vec<NativeX360Report>>>) {
    let reports = Rc::new(RefCell::new(Vec::new()));
    (
        RecordingSink {
            reports: Rc::clone(&reports),
            dispatch_error: None,
        },
        reports,
    )
}

impl<S> Controller<S> {
    pub(crate) fn new(sink: S) -> Self {
        Self { sink }
    }
}

impl<S: ReportSink> Controller<S> {
    pub(crate) fn set_state(&mut self, state: &NormalizedState) -> Result<(), String> {
        let report = state.to_native_report()?;
        self.sink
            .dispatch(report)
            .map_err(|error| format!("report dispatch failed: {error}"))
    }

    pub(crate) fn neutral(&mut self) -> Result<(), String> {
        self.sink
            .dispatch(NativeX360Report::neutral())
            .map_err(|error| format!("report dispatch failed: {error}"))
    }

    pub(crate) fn cleanup<F>(self, release: F) -> Result<(), crate::CleanupError>
    where
        F: FnOnce(S) -> Result<(), String>,
    {
        let mut sink = self.sink;
        let neutral_error = sink
            .dispatch(NativeX360Report::neutral())
            .err()
            .map(|error| format!("report dispatch failed: {error}"));
        let release_error = release(sink).err();

        if neutral_error.is_none() && release_error.is_none() {
            Ok(())
        } else {
            Err(crate::CleanupError {
                neutral_error,
                release_error,
            })
        }
    }
}

pub(crate) fn cleanup_controller<S, F>(
    controller: Option<Controller<S>>,
    release: F,
) -> Result<(), crate::CleanupError>
where
    S: ReportSink,
    F: FnOnce(S) -> Result<(), String>,
{
    match controller {
        Some(controller) => controller.cleanup(release),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    impl ReportSink for RecordingSink {
        fn dispatch(&mut self, report: NativeX360Report) -> Result<(), String> {
            self.reports.borrow_mut().push(report);
            match &self.dispatch_error {
                Some(error) => Err(error.clone()),
                None => Ok(()),
            }
        }
    }

    #[test]
    fn cleanup_releases_after_neutral_failure_and_preserves_both_errors() {
        let reports = Rc::new(RefCell::new(Vec::new()));
        let released = Rc::new(RefCell::new(false));
        let controller = Controller::new(RecordingSink {
            reports: Rc::clone(&reports),
            dispatch_error: Some("neutral unavailable".to_owned()),
        });
        let released_for_cleanup = Rc::clone(&released);

        let error = cleanup_controller(Some(controller), move |sink| {
            *released_for_cleanup.borrow_mut() = true;
            drop(sink);
            Err("unplug unavailable".to_owned())
        })
        .unwrap_err();

        assert_eq!(reports.borrow().as_slice(), &[NativeX360Report::neutral()]);
        assert!(*released.borrow());
        assert_eq!(
            error.neutral_error.as_deref(),
            Some("report dispatch failed: neutral unavailable")
        );
        assert_eq!(error.release_error.as_deref(), Some("unplug unavailable"));
    }

    #[test]
    fn repeated_cleanup_without_a_controller_is_safe() {
        let first: Option<Controller<RecordingSink>> = None;
        let second: Option<Controller<RecordingSink>> = None;

        assert!(cleanup_controller(first, |_| panic!("release must not run")).is_ok());
        assert!(cleanup_controller(second, |_| panic!("release must not run")).is_ok());
    }
}
