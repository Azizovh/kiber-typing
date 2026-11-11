import { useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Runner } from '../components/Runner';
import { LESSONS, LESSON_GROUPS, findLesson, starsFor } from '../content/lessons';
import type { Category, RunConfig, TestResult } from '../engine/types';
import { useT } from '../i18n';
import { useData } from '../store/data';

const GROUP_CATEGORY: Record<string, Category> = {
  keyboard: 'mixed',
  symbols: 'symbols',
  commands: 'commands',
  terms: 'terms',
};

export function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n}/3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? 'star on' : 'star'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function LessonsPage() {
  const t = useT();
  const progress = useData((s) => s.lessons);
  const done = LESSONS.filter((l) => (progress[l.id]?.stars ?? 0) > 0).length;

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t('lessons.title')}</h1>
        <p className="muted">{t('lessons.subtitle')}</p>
        <div className="progress" title={`${done}/${LESSONS.length}`}>
          <div className="progress-bar" style={{ width: `${(done / LESSONS.length) * 100}%` }} />
        </div>
        <p className="muted small">{t('lessons.progress', { done, total: LESSONS.length })}</p>
      </header>

      {LESSON_GROUPS.map((group) => (
        <section key={group.id} className="lesson-group">
          <h2>{group.title}</h2>
          <p className="muted">{group.desc}</p>
          <div className="cards">
            {group.lessons.map((lesson, i) => {
              const p = progress[lesson.id];
              return (
                <Link key={lesson.id} to={`/lessons/${lesson.id}`} className={`card${p ? ' done' : ''}`}>
                  <div className="card-top">
                    <span className="card-num">{String(i + 1).padStart(2, '0')}</span>
                    <Stars n={p?.stars ?? 0} />
                  </div>
                  <h3>{lesson.title}</h3>
                  {lesson.keys && <code className="card-keys">{lesson.keys}</code>}
                  <p className="muted small">{lesson.desc}</p>
                  {p && (
                    <p className="card-best">
                      {Math.round(p.wpm)} wpm · {Math.floor(p.accuracy)}%
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function LessonPage() {
  const t = useT();
  const { id = '' } = useParams();
  const lesson = findLesson(id);
  const index = LESSONS.findIndex((l) => l.id === id);
  const nextLesson = index >= 0 ? LESSONS[index + 1] : undefined;

  const tokens = useMemo(() => lesson?.build() ?? [], [lesson]);
  const config = useMemo<RunConfig>(
    () => ({
      kind: 'lesson',
      category: GROUP_CATEGORY[lesson?.group ?? ''] ?? 'mixed',
      mode: 'words',
      length: tokens.length,
      topic: null,
      strict: false,
      lessonId: id,
    }),
    [lesson, tokens, id],
  );
  const build = useCallback(() => tokens.slice(), [tokens]);
  const onResult = useCallback(
    (result: TestResult) => {
      useData.getState().recordLesson(id, result, starsFor(result.accuracy));
    },
    [id],
  );
  const resultExtra = useCallback(
    (result: TestResult) => {
      const stars = starsFor(result.accuracy);
      return (
        <div className="lesson-result">
          <Stars n={stars} />
          <span>{stars === 0 ? t('lessons.retry') : t('lessons.passed')}</span>
          {nextLesson && stars > 0 && (
            <Link className="btn primary" to={`/lessons/${nextLesson.id}`}>
              {t('lessons.next')}: {nextLesson.title} →
            </Link>
          )}
        </div>
      );
    },
    [nextLesson, t],
  );

  if (!lesson) {
    return (
      <div className="page">
        <p className="notice warn">{t('lessons.notFound')}</p>
        <Link to="/lessons" className="btn">
          ← {t('lessons.title')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page type-page">
      <header className="lesson-head">
        <Link to="/lessons" className="back">
          ← {t('lessons.title')}
        </Link>
        <h1>{lesson.title}</h1>
        <p className="muted">{lesson.desc}</p>
        <p className="muted small">{t('lessons.starsHelp')}</p>
      </header>
      <Runner key={id} config={config} build={build} onResult={onResult} resultExtra={resultExtra} />
    </div>
  );
}
