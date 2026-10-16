-- One code_analysis requirement per screen/behaviour per application.
--
-- Re-analysis used to insert a new requirement every time, leaving several per
-- screen that were each tested separately. Hide the superseded ones (soft
-- delete only - nothing is removed, flip is_deleted back to 0 to restore),
-- keeping per screen the newest requirement that did not fail (or, if every
-- one failed, the newest). Their scenarios are hidden with them so Test Case
-- Management doesn't list two generations side by side; their test files,
-- runs and commits stay in the history.
UPDATE `requirements` SET `is_deleted` = 1
WHERE `source` = 'code_analysis' AND `is_deleted` = 0 AND `source_module` IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM `requirements` r2
    WHERE r2.`source` = 'code_analysis' AND r2.`is_deleted` = 0
      AND r2.`source_module` = `requirements`.`source_module`
      AND COALESCE(r2.`application_id`, '') = COALESCE(`requirements`.`application_id`, '')
      AND r2.`id` <> `requirements`.`id`
      AND (
        (CASE WHEN r2.`status` <> 'failed' THEN 1 ELSE 0 END) > (CASE WHEN `requirements`.`status` <> 'failed' THEN 1 ELSE 0 END)
        OR (
          (CASE WHEN r2.`status` <> 'failed' THEN 1 ELSE 0 END) = (CASE WHEN `requirements`.`status` <> 'failed' THEN 1 ELSE 0 END)
          AND (r2.`created_at` > `requirements`.`created_at` OR (r2.`created_at` = `requirements`.`created_at` AND r2.`rowid` > `requirements`.`rowid`))
        )
      )
  );--> statement-breakpoint
UPDATE `scenarios` SET `is_deleted` = 1
WHERE `is_deleted` = 0 AND `requirement_id` IN (SELECT `id` FROM `requirements` WHERE `source` = 'code_analysis' AND `is_deleted` = 1);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `requirements_code_analysis_screen_uq`
ON `requirements` (COALESCE(`application_id`, ''), `source_module`)
WHERE `source` = 'code_analysis' AND `is_deleted` = 0 AND `source_module` IS NOT NULL;
