import * as React from 'react';
import { Row } from './Row';
import { Today } from './Today';
import {
  getHistoryQueue,
  RowType,
  SYNC_TIMER,
  TaskItem,
  TaskStatus,
} from '../helpers/utils';
import { InputBox } from './InputBox';
import { GoogleAnalytics } from './GoogleAnalytics';
import { CodeEditor } from './CodeEditor';
import { ArchivedList } from './ArchivedList';
import { HelpDialog } from './HelpDialog';
import { AuthDialog } from './AuthDialog';
import { pullFromDB, pushToDB } from '../helpers/api';
import { SyncStatus } from './SyncStatus';
import { QuickHelp } from './QuickHelp';

export const StateContext = React.createContext<any>(null);

const defaultState = {
  tasks: [] as TaskItem[],
  showHelp: false,
  showQuickHelp: true,
  showToday: false,
  darkMode: false,
  sawTheInput: false,
  taskVisibility: {
    done: true,
    flagged: true,
    wait: true,
    wip: true,
  },
  history: getHistoryQueue(),
  showCustomCSS: false,
  customCSS: '',
  showArchived: false,
  userWantToLogin: false,
  authToken: '',
  serverUrl: '',
  lastSync: 0,
};

const getInitialState = () => {
  if (window.localStorage) {
    const saved = window.localStorage.getItem('pomoday');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          for (let key in defaultState) {
            if (!parsed.hasOwnProperty(key)) {
              parsed[key] = defaultState[key];
            }
          }
          return parsed;
        }
      } catch {}
    }
  }
  return defaultState;
};

const syncTasks = async (state, setState) => {
  await pushToDB(state.tasks, state.serverUrl, state.authToken);
  const updatedTasks = await pullFromDB(state.serverUrl, state.authToken);
  setState({
    ...state,
    tasks: updatedTasks,
    lastSync: Date.now(),
  });
};

export const App = () => {
  const [state, setState] = React.useState(getInitialState());

  React.useEffect(() => {
    window.localStorage.setItem('pomoday', JSON.stringify(state));
    if (state.authToken && Date.now() - state.lastSync > SYNC_TIMER) {
      (async () => {
        await syncTasks(state, setState);
      })();
    }
  }, [state]);

  const getVisibilityStatusText = (): string[] => {
    const hidden = Object.keys(state.taskVisibility)
      .reduce((arr, k) => {
        if (state.taskVisibility[k] === false) {
          arr.push(k);
        }
        return arr;
      }, [])
      .map(t => {
        if (t === 'done') return 'Finished';
        if (t === 'flagged') return 'Flagged';
        if (t === 'wait') return 'Pending';
        if (t === 'wip') return 'On Going';
      });
    return hidden;
  };

  const taskGroups = state.tasks
    .filter(t => t.status !== TaskStatus.NONE)
    .filter(t => !t.archived)
    .reduce(
      (groups, t: TaskItem) => {
        if (!groups.display[t.tag]) {
          groups.display[t.tag] = [];
        }
        if (
          (t.status === TaskStatus.DONE && state.taskVisibility.done) ||
          (t.status === TaskStatus.FLAG && state.taskVisibility.flagged) ||
          (t.status === TaskStatus.WAIT && state.taskVisibility.wait) ||
          (t.status === TaskStatus.WIP && state.taskVisibility.wip)
        ) {
          groups.display[t.tag].push(t);
        } else {
          groups.hidden.push(t);
        }
        return groups;
      },
      {
        display: {},
        hidden: [],
      },
    );

  const summary = state.tasks.reduce(
    (stats, t) => {
      switch (t.status) {
        case TaskStatus.WAIT:
          stats.pending += 1;
          break;
        case TaskStatus.DONE:
          stats.done += 1;
          break;
        case TaskStatus.WIP:
          stats.wip += 1;
          break;
      }
      return stats;
    },
    {
      done: 0,
      wip: 0,
      pending: 0,
    },
  );

  const countDone = (group, g) => {
    return (
      group.hidden.filter(t => t.tag === g && t.status === TaskStatus.DONE)
        .length +
      group.display[g].filter(t => t.status === TaskStatus.DONE).length
    );
  };

  const countTotal = (group, g) => {
    return (
      taskGroups.display[g].length +
      group.hidden.filter(t => t.tag === g).length
    );
  };

  return (
    <StateContext.Provider value={[state, setState]}>
      <style dangerouslySetInnerHTML={{ __html: state.customCSS }} />
      <div
        className={`w-screen h-screen relative flex flex-col font-mono text-foreground bg-background ${
          state.darkMode ? 'dark' : 'light'
        }`}>
        <SyncStatus />
        <div className="flex-1 flex flex-col sm:flex-row bg-background overflow-hidden">
          {/* Today */}
          <div className="el-main-view flex-1 p-5 h-full overflow-y-auto">
            {taskGroups.hidden.length ? (
              <div className="pb-5 text-stall-dim">
                {taskGroups.hidden.length} tasks in{' '}
                {getVisibilityStatusText().join(', ')} group are hidden.
              </div>
            ) : null}
            <div>
              {Object.keys(taskGroups.display).map((g, i) => [
                <Row
                  key={`tag-${i}`}
                  type={RowType.TAG}
                  text={g}
                  sidetext={`[${countDone(taskGroups, g)}/${countTotal(
                    taskGroups,
                    g,
                  )}]`}
                />,
                taskGroups.display[g].map((t, j) => (
                  <Row
                    key={`tag-${i}-inner-task-${j}-${t.id}`}
                    type={RowType.TASK}
                    task={t}
                  />
                )),
                <Row
                  key={`tag-${i}-separator-${i}`}
                  type={RowType.TEXT}
                  text=""
                />,
              ])}
              <Row
                type={RowType.TEXT}
                text={`${(
                  (summary.done / state.tasks.length) * 100 || 0
                ).toFixed(0)}% of all tasks complete.`}
              />
              <Row
                type={RowType.TEXT}
                text={`<span class="text-green">${summary.done}</span> done · <span class="text-orange">${summary.wip}</span> in-progress · <span class="text-purple">${summary.pending}</span> waiting`}
              />
            </div>
          </div>
          {/* Today */}
          {state.showToday ? (
            <div className="el-sideview w-full h-full absolute sm:relative top-0 left-0 right-0 bottom-0 sm:top-auto sm:left-auto sm:right-auto sm:bottom-auto overflow-y-auto sm:w-2/6 p-5 text-sm text-left border-l border-control">
              <Today />
            </div>
          ) : null}
          {/* Help */}
          {state.showHelp ? <HelpDialog /> : null}
          {state.showQuickHelp ? <QuickHelp /> : null}
          {/* Custom CSS */}
          {state.showCustomCSS ? (
            <div className="el-sideview w-full h-full absolute sm:relative top-0 left-0 right-0 bottom-0 sm:top-auto sm:left-auto sm:right-auto sm:bottom-auto overflow-y-auto sm:w-2/6 p-5 text-sm text-left border-l border-control flex">
              <CodeEditor />
            </div>
          ) : null}
          {/* Archived List */}
          {state.showArchived ? (
            <div className="el-sideview w-full h-full absolute sm:relative top-0 left-0 right-0 bottom-0 sm:top-auto sm:left-auto sm:right-auto sm:bottom-auto overflow-y-auto sm:w-2/6 p-5 text-sm text-left border-l border-control flex">
              <ArchivedList />
            </div>
          ) : null}
          {!state.authToken && state.userWantToLogin ? <AuthDialog /> : null}
        </div>
        <InputBox />
      </div>
      <GoogleAnalytics />
    </StateContext.Provider>
  );
};
