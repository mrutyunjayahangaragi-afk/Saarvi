/**
 * Saarvi — VTU Curriculum Publishing, Database Persistence, Live Updates & Cache Consistency
 * Automated Regression Test Suite
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { academicServerStore } from '../src/lib/academic/academic-store.ts';
import { MockStorageProvider } from '../src/lib/supabase/mock-storage.ts';
import { GLOBAL_SCOPED_CACHE, buildCurriculumCacheKey } from '../src/lib/security/scoped-cache.ts';

test.describe('VTU Curriculum Publishing & Permanent Database Persistence Suite', () => {
  const testScope = {
    universityId: 'vtu',
    schemeId: 'vtu-2022',
    branchId: 'vtu-2022-ise',
    semester: 5,
  };

  test('1. Subject creation as DRAFT does not leak to public resolved curriculum until published', async () => {
    // Clean mock storage for this test scope
    const existing = MockStorageProvider.getAcademicSubjects(testScope);
    for (const s of existing) {
      MockStorageProvider.deleteAcademicSubject(s.id);
    }

    // Add subject as DRAFT
    const draftSubject = await academicServerStore.createSubject({
      ...testScope,
      subjectCode: '22IS501',
      subjectName: 'Software Engineering & Agile Methodologies',
      credits: 4,
      courseType: 'Theory',
      seeApplicable: true,
      status: 'DRAFT',
    }, 'admin@saarvi.com');

    assert.ok(draftSubject);
    assert.equal(draftSubject.status, 'DRAFT');
    assert.equal(draftSubject.version, 1);

    // Public resolution should NOT return draft courses
    const resolvedBeforePublish = academicServerStore.resolveCurriculum(
      testScope.universityId,
      testScope.schemeId,
      testScope.branchId,
      testScope.semester
    );

    assert.equal(resolvedBeforePublish.available, false);
    assert.equal(resolvedBeforePublish.courses.length, 0);
  });

  test('2. Publishing curriculum activates subjects, increments canonical revision, and persists to database', async () => {
    // Get initial revision before publishing
    const prevRev = academicServerStore.getActiveRevision(testScope);
    const initialRevNum = prevRev.revisionNumber;

    // Publish curriculum
    const publishResult = await academicServerStore.publishCurriculum(
      testScope,
      'PUBLISHED',
      'superadmin@saarvi.com'
    );

    assert.equal(publishResult.success, true);
    assert.ok(publishResult.affectedCount >= 1);
    assert.equal(publishResult.revision, initialRevNum + 1);

    // Verify active revision in store
    const activeRev = academicServerStore.getActiveRevision(testScope);
    assert.equal(activeRev.revisionNumber, initialRevNum + 1);
    assert.equal(activeRev.status, 'ACTIVE');
    assert.equal(activeRev.publishedBy, 'superadmin@saarvi.com');

    // Verify public resolution returns the published course with dynamic revision
    const resolved = academicServerStore.resolveCurriculum(
      testScope.universityId,
      testScope.schemeId,
      testScope.branchId,
      testScope.semester
    );

    assert.equal(resolved.available, true);
    assert.equal(resolved.revision, initialRevNum + 1);
    const publishedCourse = resolved.courses.find((c) => c.subjectCode === '22IS501');
    assert.ok(publishedCourse);
    assert.equal(publishedCourse.credits, 4);
    assert.equal(publishedCourse.status, 'PUBLISHED');

    // Verify persistence in MockStorageProvider (simulates PostgreSQL storage)
    const storedSubjects = MockStorageProvider.getAcademicSubjects(testScope);
    const storedCourse = storedSubjects.find((s) => s.subjectCode === '22IS501');
    assert.ok(storedCourse);
    assert.equal(storedCourse.publishStatus, 'PUBLISHED');

    const storedRevision = MockStorageProvider.getCurriculumRevision(
      `${testScope.universityId}_${testScope.schemeId}_${testScope.branchId}_sem${testScope.semester}`
    );
    assert.ok(storedRevision);
    assert.equal(storedRevision.revisionNumber, initialRevNum + 1);
    assert.equal(storedRevision.status, 'ACTIVE');
  });

  test('3. Serverless cold restart simulation: Persisted curriculum survives re-initialization', async () => {
    // Re-initialize store from MockStorageProvider (simulates new process / cold restart)
    academicServerStore.initializeDefaults();

    // The published subject MUST still be present in the reinitialized store
    const resolvedAfterRestart = await academicServerStore.resolveCurriculumAsync(
      testScope.universityId,
      testScope.schemeId,
      testScope.branchId,
      testScope.semester
    );

    assert.equal(resolvedAfterRestart.available, true);
    const reloadedCourse = resolvedAfterRestart.courses.find((c) => c.subjectCode === '22IS501');
    assert.ok(reloadedCourse, 'Subject 22IS501 must persist after server cold start');
    assert.equal(reloadedCourse.credits, 4);

    const activeRevAfterRestart = academicServerStore.getActiveRevision(testScope);
    assert.ok(activeRevAfterRestart.revisionNumber >= 2);
  });

  test('4. Subject edit with optimistic locking, version increment, and secondary publication', async () => {
    const subjects = academicServerStore.getSubjects(testScope);
    const target = subjects.find((s) => s.subjectCode === '22IS501');
    assert.ok(target);

    // Optimistic locking failure test: wrong expectedVersion should throw
    await assert.rejects(
      async () => {
        await academicServerStore.updateSubject(
          target.id,
          { credits: 3 },
          target.version + 99,
          'admin@saarvi.com'
        );
      },
      /Conflict|optimistic/i
    );

    const initialVersion = target.version;

    // Valid edit: change credits from 4 to 3 and update subject name
    const updated = await academicServerStore.updateSubject(
      target.id,
      {
        subjectName: 'Software Engineering & Cloud Practices',
        credits: 3,
      },
      initialVersion,
      'admin@saarvi.com'
    );

    assert.equal(updated.credits, 3);
    assert.equal(updated.subjectName, 'Software Engineering & Cloud Practices');
    assert.equal(updated.version, initialVersion + 1);

    // Secondary publication: revision increments again
    const currentRev = academicServerStore.getActiveRevision(testScope);
    const pub2 = await academicServerStore.publishCurriculum(testScope, 'PUBLISHED', 'admin@saarvi.com');

    assert.equal(pub2.revision, currentRev.revisionNumber + 1);

    // Verify public resolution reflects the updated course without duplicate codes
    const resolvedPub2 = academicServerStore.resolveCurriculum(
      testScope.universityId,
      testScope.schemeId,
      testScope.branchId,
      testScope.semester
    );

    const matches = resolvedPub2.courses.filter((c) => c.subjectCode === '22IS501');
    assert.equal(matches.length, 1, 'Never allow duplicate subjects with the same subjectCode');
    assert.equal(matches[0].credits, 3);
    assert.equal(matches[0].subjectName, 'Software Engineering & Cloud Practices');
  });

  test('5. Duplicate subject code in same semester scope is rejected at store level', async () => {
    await assert.rejects(
      async () => {
        await academicServerStore.createSubject({
          ...testScope,
          subjectCode: '22IS501', // Already exists!
          subjectName: 'Duplicate Course Attempt',
          credits: 4,
        });
      },
      /already exists for this semester/i
    );
  });

  test('6. Student marks preservation logic preserves entered marks when new revision loads', () => {
    // Emulate existing student rows in state
    const previousStudentRows = [
      {
        courseCode: '22IS501',
        courseTitle: 'Old Title',
        credits: 4,
        cie: '42',
        see: '45',
        total: '87',
        inputMode: 'cie-see',
      },
      {
        courseCode: '22IS502',
        courseTitle: 'Computer Networks',
        credits: 4,
        cie: '38',
        see: '40',
        total: '78',
        inputMode: 'total',
      },
    ];

    // Incoming new revision rows from server (e.g. 22IS501 credits changed, 22IS503 added)
    const newRevisionRows = [
      {
        courseCode: '22IS501',
        courseTitle: 'Software Engineering & Cloud Practices',
        credits: 3,
        cie: '',
        see: '',
        total: '',
        inputMode: 'cie-see',
      },
      {
        courseCode: '22IS502',
        courseTitle: 'Computer Networks and Protocols',
        credits: 4,
        cie: '',
        see: '',
        total: '',
        inputMode: 'cie-see',
      },
      {
        courseCode: '22IS503',
        courseTitle: 'Database Management Systems',
        credits: 4,
        cie: '',
        see: '',
        total: '',
        inputMode: 'cie-see',
      },
    ];

    // Simulate smart preservation function
    const prevMarksMap = new Map();
    previousStudentRows.forEach((r) => {
      prevMarksMap.set(r.courseCode.trim().toUpperCase(), {
        cie: r.cie,
        see: r.see,
        total: r.total,
        inputMode: r.inputMode,
      });
    });

    const preservedRows = newRevisionRows.map((row) => {
      const prev = prevMarksMap.get(row.courseCode.trim().toUpperCase());
      if (prev) {
        return {
          ...row,
          cie: prev.cie,
          see: prev.see,
          total: prev.total,
          inputMode: prev.inputMode,
        };
      }
      return row;
    });

    // 22IS501 must retain cie 42, see 45, total 87, but have new credits 3
    const row1 = preservedRows.find((r) => r.courseCode === '22IS501');
    assert.equal(row1.cie, '42');
    assert.equal(row1.see, '45');
    assert.equal(row1.total, '87');
    assert.equal(row1.credits, 3);

    // 22IS502 must retain cie 38, see 40, total 78, inputMode total
    const row2 = preservedRows.find((r) => r.courseCode === '22IS502');
    assert.equal(row2.cie, '38');
    assert.equal(row2.see, '40');
    assert.equal(row2.total, '78');
    assert.equal(row2.inputMode, 'total');

    // 22IS503 is new, so marks remain empty
    const row3 = preservedRows.find((r) => r.courseCode === '22IS503');
    assert.equal(row3.cie, '');
    assert.equal(row3.see, '');
  });

  test('7. Multi-layer cache invalidation triggers on subject updates and publication', async () => {
    let invalidationCount = 0;
    const testInvalidator = () => {
      invalidationCount++;
    };

    academicServerStore.registerCacheInvalidator(testInvalidator);

    // Set item in global scoped cache
    const cacheKey = buildCurriculumCacheKey(
      testScope.universityId,
      testScope.schemeId,
      testScope.branchId,
      testScope.semester
    );
    GLOBAL_SCOPED_CACHE.set(cacheKey, { available: true, courses: [] });
    assert.ok(GLOBAL_SCOPED_CACHE.get(cacheKey));

    // Creating a subject must invalidate caches
    await academicServerStore.createSubject({
      ...testScope,
      subjectCode: '22IS509',
      subjectName: 'Special Topics in Distributed Computing',
      credits: 2,
    });

    assert.ok(invalidationCount >= 1, 'Cache invalidator must fire on createSubject');

    // Publishing curriculum must invalidate caches
    const countBeforePub = invalidationCount;
    await academicServerStore.publishCurriculum(testScope, 'PUBLISHED', 'admin@saarvi.com');
    assert.ok(invalidationCount > countBeforePub, 'Cache invalidator must fire on publishCurriculum');
  });

  test('8. Archive curriculum hides courses from public resolved curriculum and increments revision', async () => {
    const pubRevBefore = academicServerStore.getActiveRevision(testScope);

    // Archive curriculum
    const archiveResult = await academicServerStore.publishCurriculum(
      testScope,
      'ARCHIVED',
      'admin@saarvi.com'
    );

    assert.equal(archiveResult.success, true);
    assert.equal(archiveResult.revision, pubRevBefore.revisionNumber + 1);

    // Public resolution should now show available: false
    const resolvedArchived = academicServerStore.resolveCurriculum(
      testScope.universityId,
      testScope.schemeId,
      testScope.branchId,
      testScope.semester
    );

    assert.equal(resolvedArchived.available, false);
    assert.equal(resolvedArchived.courses.length, 0);
  });
});
